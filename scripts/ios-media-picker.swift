import Photos
import PhotosUI
import UniformTypeIdentifiers

class OrderedMediaViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(OrderedMediaPickerPlugin())
    }
}

@objc(OrderedMediaPickerPlugin)
public class OrderedMediaPickerPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    public let identifier = "OrderedMediaPickerPlugin"
    public let jsName = "OrderedMediaPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise)
    ]
    private var pendingCall: CAPPluginCall?
    private var selectionDirectory: URL?
    private var preselectedIdentifiers: [String] = []
    private lazy var pickerDevice: String = {
        let key = "geonjukong-picker-device"
        if let device = UserDefaults.standard.string(forKey: key) { return device }
        let device = "ios:" + UUID().uuidString
        UserDefaults.standard.set(device, forKey: key)
        return device
    }()

    @objc func pick(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pendingCall == nil, self.selectionDirectory == nil,
                  let presenter = self.bridge?.viewController, presenter.presentedViewController == nil else {
                call.reject("사진 선택이 끝날 때까지 기다려 주세요.")
                return
            }
            var configuration = PHPickerConfiguration(photoLibrary: PHPhotoLibrary.shared())
            configuration.filter = .any(of: [.images, .videos])
            configuration.selectionLimit = 0
            self.preselectedIdentifiers = []
            if #available(iOS 15.0, *) {
                configuration.selection = .ordered
                let assets = call.getArray("selectedAssets", JSObject.self) ?? []
                var seen = Set<String>()
                self.preselectedIdentifiers = assets.compactMap { asset -> String? in
                    guard let device = asset["device"] as? String, device == self.pickerDevice,
                          let identifier = asset["uri"] as? String, !identifier.isEmpty,
                          seen.insert(identifier).inserted else { return nil }
                    return identifier
                }
                configuration.preselectedAssetIdentifiers = self.preselectedIdentifiers
            }
            configuration.preferredAssetRepresentationMode = .current
            let picker = PHPickerViewController(configuration: configuration)
            picker.delegate = self
            self.pendingCall = call
            presenter.present(picker, animated: true)
        }
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pendingCall else { return }
        let identifiers = results.compactMap { $0.assetIdentifier }
        guard identifiers.count == results.count else {
            failSelection(call)
            return
        }
        // Cancel returns the original preselection with empty item providers.
        if identifiers == preselectedIdentifiers {
            pendingCall = nil
            preselectedIdentifiers = []
            call.resolve(["cancelled": true, "files": []])
            return
        }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            selectionDirectory = directory
            loadSelection(results, index: 0, files: [], directory: directory, call: call)
        } catch {
            failSelection(call)
        }
    }

    private func loadSelection(_ results: [PHPickerResult], index: Int, files: [[String: Any]], directory: URL, call: CAPPluginCall) {
        if index == results.count {
            let response: [String: Any] = ["selectionId": directory.lastPathComponent, "files": files,
                "selectedUris": results.compactMap { $0.assetIdentifier },
                "preselectedUris": preselectedIdentifiers, "pickerDevice": pickerDevice]
            pendingCall = nil
            preselectedIdentifiers = []
            call.resolve(response)
            return
        }
        guard let assetIdentifier = results[index].assetIdentifier else {
            failSelection(call)
            return
        }
        // Preselected results have no file provider; their originals are already attached.
        if preselectedIdentifiers.contains(assetIdentifier) {
            loadSelection(results, index: index + 1, files: files, directory: directory, call: call)
            return
        }
        let provider = results[index].itemProvider
        guard let identifier = provider.registeredTypeIdentifiers.first(where: {
            guard let type = UTType($0) else { return false }
            return type.conforms(to: .image) || type.conforms(to: .movie)
        }) else {
            failSelection(call)
            return
        }
        // The provider's temporary URL is valid only during this callback.
        provider.loadFileRepresentation(forTypeIdentifier: identifier) { url, error in
            do {
                guard error == nil, let url = url else { throw CocoaError(.fileReadUnknown) }
                let destination = directory.appendingPathComponent("\(index).\(url.pathExtension)")
                try FileManager.default.copyItem(at: url, to: destination)
                let type = UTType(filenameExtension: url.pathExtension) ?? UTType(identifier)
                var name = provider.suggestedName ?? url.lastPathComponent
                if (name as NSString).pathExtension.isEmpty { name += ".\(url.pathExtension)" }
                let attributes = try FileManager.default.attributesOfItem(atPath: destination.path)
                let modified = attributes[.modificationDate] as? Date ?? Date()
                let file: [String: Any] = ["path": destination.absoluteString, "name": name,
                    "type": type?.preferredMIMEType ?? "", "lastModified": modified.timeIntervalSince1970 * 1000,
                    "pickerUri": assetIdentifier, "pickerDevice": self.pickerDevice]
                DispatchQueue.main.async {
                    self.loadSelection(results, index: index + 1, files: files + [file], directory: directory, call: call)
                }
            } catch {
                DispatchQueue.main.async { self.failSelection(call) }
            }
        }
    }

    private func failSelection(_ call: CAPPluginCall) {
        if let directory = selectionDirectory { try? FileManager.default.removeItem(at: directory) }
        selectionDirectory = nil
        pendingCall = nil
        preselectedIdentifiers = []
        call.reject("선택한 사진·동영상을 읽지 못했어요. 다시 선택해 주세요.")
    }

    @objc func release(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let directory = self.selectionDirectory, call.getString("selectionId") == directory.lastPathComponent else {
                call.reject("사진 선택 임시 파일을 찾지 못했어요.")
                return
            }
            do {
                try FileManager.default.removeItem(at: directory)
                self.selectionDirectory = nil
                call.resolve()
            } catch {
                call.reject("사진 선택 임시 파일을 정리하지 못했어요.")
            }
        }
    }
}
