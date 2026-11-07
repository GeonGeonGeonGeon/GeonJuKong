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

    @objc func pick(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pendingCall == nil, self.selectionDirectory == nil,
                  let presenter = self.bridge?.viewController, presenter.presentedViewController == nil else {
                call.reject("사진 선택이 끝날 때까지 기다려 주세요.")
                return
            }
            var configuration = PHPickerConfiguration()
            configuration.filter = .any(of: [.images, .videos])
            configuration.selectionLimit = 0
            if #available(iOS 15.0, *) { configuration.selection = .ordered }
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
        if results.isEmpty {
            pendingCall = nil
            call.resolve(["files": []])
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
            pendingCall = nil
            call.resolve(["selectionId": directory.lastPathComponent, "files": files])
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
                    "type": type?.preferredMIMEType ?? "", "lastModified": modified.timeIntervalSince1970 * 1000]
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
