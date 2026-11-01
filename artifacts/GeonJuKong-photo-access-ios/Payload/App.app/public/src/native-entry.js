var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@capacitor/core/dist/index.js
var ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp;
var init_dist = __esm({
  "node_modules/@capacitor/core/dist/index.js"() {
    (function(ExceptionCode2) {
      ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
      ExceptionCode2["Unavailable"] = "UNAVAILABLE";
    })(ExceptionCode || (ExceptionCode = {}));
    CapacitorException = class extends Error {
      constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
      }
    };
    getPlatformId = (win) => {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return "android";
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return "ios";
      } else {
        return "web";
      }
    };
    createCapacitor = (win) => {
      const capCustomPlatform = win.CapacitorCustomPlatform || null;
      const cap = win.Capacitor || {};
      const Plugins = cap.Plugins = cap.Plugins || {};
      const getPlatform = () => {
        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
      };
      const isNativePlatform = () => getPlatform() !== "web";
      const isPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
          return true;
        }
        if (getPluginHeader(pluginName)) {
          return true;
        }
        return false;
      };
      const getPluginHeader = (pluginName) => {
        var _a;
        return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
      };
      const handleError = (err) => win.console.error(err);
      const registeredPlugins = /* @__PURE__ */ new Map();
      const registerPlugin2 = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
          console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
          return registeredPlugin.proxy;
        }
        const platform = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
          if (!jsImplementation && platform in jsImplementations) {
            jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
          } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
            jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
          }
          return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
          var _a, _b;
          if (pluginHeader) {
            const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
            if (methodHeader) {
              if (methodHeader.rtype === "promise") {
                return (options) => cap.nativePromise(pluginName, prop.toString(), options);
              } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
              }
            } else if (impl) {
              return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
            }
          } else if (impl) {
            return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
          } else {
            throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
          }
        };
        const createPluginMethodWrapper = (prop) => {
          let remove;
          const wrapper = (...args) => {
            const p = loadPluginImplementation().then((impl) => {
              const fn = createPluginMethod(impl, prop);
              if (fn) {
                const p2 = fn(...args);
                remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                return p2;
              } else {
                throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
              }
            });
            if (prop === "addListener") {
              p.remove = async () => remove();
            }
            return p;
          };
          wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
          Object.defineProperty(wrapper, "name", {
            value: prop,
            writable: false,
            configurable: false
          });
          return wrapper;
        };
        const addListener = createPluginMethodWrapper("addListener");
        const removeListener = createPluginMethodWrapper("removeListener");
        const addListenerNative = (eventName, callback) => {
          const call = addListener({ eventName }, callback);
          const remove = async () => {
            const callbackId = await call;
            removeListener({
              eventName,
              callbackId
            }, callback);
          };
          const p = new Promise((resolve2) => call.then(() => resolve2({ remove })));
          p.remove = async () => {
            console.warn(`Using addListener() without 'await' is deprecated.`);
            await remove();
          };
          return p;
        };
        const proxy = new Proxy({}, {
          get(_, prop) {
            switch (prop) {
              // https://github.com/facebook/react/issues/20030
              case "$$typeof":
                return void 0;
              case "toJSON":
                return () => ({});
              case "addListener":
                return pluginHeader ? addListenerNative : addListener;
              case "removeListener":
                return removeListener;
              default:
                return createPluginMethodWrapper(prop);
            }
          }
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
          name: pluginName,
          proxy,
          platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
        });
        return proxy;
      };
      if (!cap.convertFileSrc) {
        cap.convertFileSrc = (filePath) => filePath;
      }
      cap.getPlatform = getPlatform;
      cap.handleError = handleError;
      cap.isNativePlatform = isNativePlatform;
      cap.isPluginAvailable = isPluginAvailable;
      cap.registerPlugin = registerPlugin2;
      cap.Exception = CapacitorException;
      cap.DEBUG = !!cap.DEBUG;
      cap.isLoggingEnabled = !!cap.isLoggingEnabled;
      return cap;
    };
    initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
    Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
    registerPlugin = Capacitor.registerPlugin;
    WebPlugin = class {
      constructor() {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
      }
      addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
          this.listeners[eventName] = [];
          firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
          this.addWindowListener(windowListener);
        }
        if (firstListener) {
          this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove });
        return p;
      }
      async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
          this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
      }
      notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          if (retainUntilConsumed) {
            let args = this.retainedEventArguments[eventName];
            if (!args) {
              args = [];
            }
            args.push(data);
            this.retainedEventArguments[eventName] = args;
          }
          return;
        }
        listeners.forEach((listener) => listener(data));
      }
      hasListeners(eventName) {
        var _a;
        return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
      }
      registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
          registered: false,
          windowEventName,
          pluginEventName,
          handler: (event) => {
            this.notifyListeners(pluginEventName, event);
          }
        };
      }
      unimplemented(msg = "not implemented") {
        return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
      }
      unavailable(msg = "not available") {
        return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
      }
      async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          return;
        }
        const index = listeners.indexOf(listenerFunc);
        this.listeners[eventName].splice(index, 1);
        if (!this.listeners[eventName].length) {
          this.removeWindowListener(this.windowListeners[eventName]);
        }
      }
      addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
      }
      removeWindowListener(handle) {
        if (!handle) {
          return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
      }
      sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
          return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach((arg) => {
          this.notifyListeners(eventName, arg);
        });
      }
    };
    encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
    decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    CapacitorCookiesPluginWeb = class extends WebPlugin {
      async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(";").forEach((cookie) => {
          if (cookie.length <= 0)
            return;
          let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
          key = decode(key).trim();
          value = decode(value).trim();
          cookieMap[key] = value;
        });
        return cookieMap;
      }
      async setCookie(options) {
        try {
          const encodedKey = encode(options.key);
          const encodedValue = encode(options.value);
          const expires2 = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
          const path = (options.path || "/").replace("path=", "");
          const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
          document.cookie = `${encodedKey}=${encodedValue || ""}${expires2}; path=${path}; ${domain};`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async deleteCookie(options) {
        try {
          document.cookie = `${options.key}=; Max-Age=0`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearCookies() {
        try {
          const cookies = document.cookie.split(";") || [];
          for (const cookie of cookies) {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearAllCookies() {
        try {
          await this.clearCookies();
        } catch (error) {
          return Promise.reject(error);
        }
      }
    };
    CapacitorCookies = registerPlugin("CapacitorCookies", {
      web: () => new CapacitorCookiesPluginWeb()
    });
    readBlobAsBase64 = async (blob) => new Promise((resolve2, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve2(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
    normalizeHttpHeaders = (headers = {}) => {
      const originalKeys = Object.keys(headers);
      const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
      const normalized = loweredKeys.reduce((acc, key, index) => {
        acc[key] = headers[originalKeys[index]];
        return acc;
      }, {});
      return normalized;
    };
    buildUrlParams = (params, shouldEncode = true) => {
      if (!params)
        return null;
      const output = Object.entries(params).reduce((accumulator, entry) => {
        const [key, value] = entry;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
          item = "";
          value.forEach((str) => {
            encodedValue = shouldEncode ? encodeURIComponent(str) : str;
            item += `${key}=${encodedValue}&`;
          });
          item.slice(0, -1);
        } else {
          encodedValue = shouldEncode ? encodeURIComponent(value) : value;
          item = `${key}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
      }, "");
      return output.substr(1);
    };
    buildRequestInit = (options, extra = {}) => {
      const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
      const headers = normalizeHttpHeaders(options.headers);
      const type = headers["content-type"] || "";
      if (typeof options.data === "string") {
        output.body = options.data;
      } else if (type.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.data || {})) {
          params.set(key, value);
        }
        output.body = params.toString();
      } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
          options.data.forEach((value, key) => {
            form.append(key, value);
          });
        } else {
          for (const key of Object.keys(options.data)) {
            form.append(key, options.data[key]);
          }
        }
        output.body = form;
        const headers2 = new Headers(output.headers);
        headers2.delete("content-type");
        output.headers = headers2;
      } else if (type.includes("application/json") || typeof options.data === "object") {
        output.body = JSON.stringify(options.data);
      }
      return output;
    };
    CapacitorHttpPluginWeb = class extends WebPlugin {
      /**
       * Perform an Http request given a set of options
       * @param options Options to build the HTTP request
       */
      async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get("content-type") || "";
        let { responseType = "text" } = response.ok ? options : {};
        if (contentType.includes("application/json")) {
          responseType = "json";
        }
        let data;
        let blob;
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            blob = await response.blob();
            data = await readBlobAsBase64(blob);
            break;
          case "json":
            data = await response.json();
            break;
          case "document":
          case "text":
          default:
            data = await response.text();
        }
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          data,
          headers,
          status: response.status,
          url: response.url
        };
      }
      /**
       * Perform an Http GET request given a set of options
       * @param options Options to build the HTTP request
       */
      async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
      }
      /**
       * Perform an Http POST request given a set of options
       * @param options Options to build the HTTP request
       */
      async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
      }
      /**
       * Perform an Http PUT request given a set of options
       * @param options Options to build the HTTP request
       */
      async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
      }
      /**
       * Perform an Http PATCH request given a set of options
       * @param options Options to build the HTTP request
       */
      async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
      }
      /**
       * Perform an Http DELETE request given a set of options
       * @param options Options to build the HTTP request
       */
      async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
      }
    };
    CapacitorHttp = registerPlugin("CapacitorHttp", {
      web: () => new CapacitorHttpPluginWeb()
    });
  }
});

// node_modules/@capacitor/app/dist/esm/web.js
var web_exports = {};
__export(web_exports, {
  AppWeb: () => AppWeb
});
var AppWeb;
var init_web = __esm({
  "node_modules/@capacitor/app/dist/esm/web.js"() {
    init_dist();
    AppWeb = class extends WebPlugin {
      constructor() {
        super();
        this.handleVisibilityChange = () => {
          const data = {
            isActive: document.hidden !== true
          };
          this.notifyListeners("appStateChange", data);
          if (document.hidden) {
            this.notifyListeners("pause", null);
          } else {
            this.notifyListeners("resume", null);
          }
        };
        document.addEventListener("visibilitychange", this.handleVisibilityChange, false);
      }
      exitApp() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getInfo() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getLaunchUrl() {
        return { url: "" };
      }
      async getState() {
        return { isActive: document.hidden !== true };
      }
      async minimizeApp() {
        throw this.unimplemented("Not implemented on web.");
      }
      async toggleBackButtonHandler() {
        throw this.unimplemented("Not implemented on web.");
      }
    };
  }
});

// node_modules/@capacitor/browser/dist/esm/web.js
var web_exports2 = {};
__export(web_exports2, {
  Browser: () => Browser,
  BrowserWeb: () => BrowserWeb
});
var BrowserWeb, Browser;
var init_web2 = __esm({
  "node_modules/@capacitor/browser/dist/esm/web.js"() {
    init_dist();
    BrowserWeb = class extends WebPlugin {
      constructor() {
        super();
        this._lastWindow = null;
      }
      async open(options) {
        this._lastWindow = window.open(options.url, options.windowName || "_blank");
      }
      async close() {
        return new Promise((resolve2, reject) => {
          if (this._lastWindow != null) {
            this._lastWindow.close();
            this._lastWindow = null;
            resolve2();
          } else {
            reject("No active window to close!");
          }
        });
      }
    };
    Browser = new BrowserWeb();
  }
});

// node_modules/@capacitor/filesystem/dist/esm/definitions.js
var Directory, Encoding;
var init_definitions = __esm({
  "node_modules/@capacitor/filesystem/dist/esm/definitions.js"() {
    (function(Directory2) {
      Directory2["Documents"] = "DOCUMENTS";
      Directory2["Data"] = "DATA";
      Directory2["Library"] = "LIBRARY";
      Directory2["Cache"] = "CACHE";
      Directory2["External"] = "EXTERNAL";
      Directory2["ExternalStorage"] = "EXTERNAL_STORAGE";
      Directory2["ExternalCache"] = "EXTERNAL_CACHE";
      Directory2["LibraryNoCloud"] = "LIBRARY_NO_CLOUD";
      Directory2["Temporary"] = "TEMPORARY";
    })(Directory || (Directory = {}));
    (function(Encoding2) {
      Encoding2["UTF8"] = "utf8";
      Encoding2["ASCII"] = "ascii";
      Encoding2["UTF16"] = "utf16";
    })(Encoding || (Encoding = {}));
  }
});

// node_modules/@capacitor/filesystem/dist/esm/web.js
var web_exports3 = {};
__export(web_exports3, {
  FilesystemWeb: () => FilesystemWeb
});
function resolve(path) {
  const posix = path.split("/").filter((item) => item !== ".");
  const newPosix = [];
  posix.forEach((item) => {
    if (item === ".." && newPosix.length > 0 && newPosix[newPosix.length - 1] !== "..") {
      newPosix.pop();
    } else {
      newPosix.push(item);
    }
  });
  return newPosix.join("/");
}
function isPathParent(parent, children) {
  parent = resolve(parent);
  children = resolve(children);
  const pathsA = parent.split("/");
  const pathsB = children.split("/");
  return parent !== children && pathsA.every((value, index) => value === pathsB[index]);
}
var FilesystemWeb;
var init_web3 = __esm({
  "node_modules/@capacitor/filesystem/dist/esm/web.js"() {
    init_dist();
    init_definitions();
    FilesystemWeb = class _FilesystemWeb extends WebPlugin {
      constructor() {
        super(...arguments);
        this.DB_VERSION = 1;
        this.DB_NAME = "Disc";
        this._writeCmds = ["add", "put", "delete"];
        this.downloadFile = async (options) => {
          var _a, _b;
          const requestInit = buildRequestInit(options, options.webFetchExtra);
          const response = await fetch(options.url, requestInit);
          let blob;
          if (!options.progress)
            blob = await response.blob();
          else if (!(response === null || response === void 0 ? void 0 : response.body))
            blob = new Blob();
          else {
            const reader = response.body.getReader();
            let bytes = 0;
            const chunks = [];
            const contentType = response.headers.get("content-type");
            const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
            while (true) {
              const { done, value } = await reader.read();
              if (done)
                break;
              chunks.push(value);
              bytes += (value === null || value === void 0 ? void 0 : value.length) || 0;
              const status = {
                url: options.url,
                bytes,
                contentLength
              };
              this.notifyListeners("progress", status);
            }
            const allChunks = new Uint8Array(bytes);
            let position = 0;
            for (const chunk of chunks) {
              if (typeof chunk === "undefined")
                continue;
              allChunks.set(chunk, position);
              position += chunk.length;
            }
            blob = new Blob([allChunks.buffer], { type: contentType || void 0 });
          }
          const result = await this.writeFile({
            path: options.path,
            directory: (_a = options.directory) !== null && _a !== void 0 ? _a : void 0,
            recursive: (_b = options.recursive) !== null && _b !== void 0 ? _b : false,
            data: blob
          });
          return { path: result.uri, blob };
        };
      }
      readFileInChunks(_options, _callback) {
        throw this.unavailable("Method not implemented.");
      }
      async initDb() {
        if (this._db !== void 0) {
          return this._db;
        }
        if (!("indexedDB" in window)) {
          throw this.unavailable("This browser doesn't support IndexedDB");
        }
        return new Promise((resolve2, reject) => {
          const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
          request.onupgradeneeded = _FilesystemWeb.doUpgrade;
          request.onsuccess = () => {
            this._db = request.result;
            resolve2(request.result);
          };
          request.onerror = () => reject(request.error);
          request.onblocked = () => {
            console.warn("db blocked");
          };
        });
      }
      static doUpgrade(event) {
        const eventTarget = event.target;
        const db2 = eventTarget.result;
        switch (event.oldVersion) {
          case 0:
          case 1:
          default: {
            if (db2.objectStoreNames.contains("FileStorage")) {
              db2.deleteObjectStore("FileStorage");
            }
            const store = db2.createObjectStore("FileStorage", { keyPath: "path" });
            store.createIndex("by_folder", "folder");
          }
        }
      }
      async dbRequest(cmd, args) {
        const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? "readwrite" : "readonly";
        return this.initDb().then((conn) => {
          return new Promise((resolve2, reject) => {
            const tx = conn.transaction(["FileStorage"], readFlag);
            const store = tx.objectStore("FileStorage");
            const req = store[cmd](...args);
            req.onsuccess = () => resolve2(req.result);
            req.onerror = () => reject(req.error);
          });
        });
      }
      async dbIndexRequest(indexName, cmd, args) {
        const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? "readwrite" : "readonly";
        return this.initDb().then((conn) => {
          return new Promise((resolve2, reject) => {
            const tx = conn.transaction(["FileStorage"], readFlag);
            const store = tx.objectStore("FileStorage");
            const index = store.index(indexName);
            const req = index[cmd](...args);
            req.onsuccess = () => resolve2(req.result);
            req.onerror = () => reject(req.error);
          });
        });
      }
      getPath(directory, uriPath) {
        const cleanedUriPath = uriPath !== void 0 ? uriPath.replace(/^[/]+|[/]+$/g, "") : "";
        let fsPath = "";
        if (directory !== void 0)
          fsPath += "/" + directory;
        if (uriPath !== "")
          fsPath += "/" + cleanedUriPath;
        return fsPath;
      }
      async clear() {
        const conn = await this.initDb();
        const tx = conn.transaction(["FileStorage"], "readwrite");
        const store = tx.objectStore("FileStorage");
        store.clear();
      }
      /**
       * Read a file from disk
       * @param options options for the file read
       * @return a promise that resolves with the read file data result
       */
      async readFile(options) {
        const path = this.getPath(options.directory, options.path);
        const entry = await this.dbRequest("get", [path]);
        if (entry === void 0)
          throw Error("File does not exist.");
        return { data: entry.content ? entry.content : "" };
      }
      /**
       * Write a file to disk in the specified location on device
       * @param options options for the file write
       * @return a promise that resolves with the file write result
       */
      async writeFile(options) {
        const path = this.getPath(options.directory, options.path);
        let data = options.data;
        const encoding = options.encoding;
        const doRecursive = options.recursive;
        const occupiedEntry = await this.dbRequest("get", [path]);
        if (occupiedEntry && occupiedEntry.type === "directory")
          throw Error("The supplied path is a directory.");
        const parentPath = path.substr(0, path.lastIndexOf("/"));
        const parentEntry = await this.dbRequest("get", [parentPath]);
        if (parentEntry === void 0) {
          const subDirIndex = parentPath.indexOf("/", 1);
          if (subDirIndex !== -1) {
            const parentArgPath = parentPath.substr(subDirIndex);
            await this.mkdir({
              path: parentArgPath,
              directory: options.directory,
              recursive: doRecursive
            });
          }
        }
        if (!encoding && !(data instanceof Blob)) {
          data = data.indexOf(",") >= 0 ? data.split(",")[1] : data;
          if (!this.isBase64String(data))
            throw Error("The supplied data is not valid base64 content.");
        }
        const now2 = Date.now();
        const pathObj = {
          path,
          folder: parentPath,
          type: "file",
          size: data instanceof Blob ? data.size : data.length,
          ctime: now2,
          mtime: now2,
          content: data
        };
        await this.dbRequest("put", [pathObj]);
        return {
          uri: pathObj.path
        };
      }
      /**
       * Append to a file on disk in the specified location on device
       * @param options options for the file append
       * @return a promise that resolves with the file write result
       */
      async appendFile(options) {
        const path = this.getPath(options.directory, options.path);
        let data = options.data;
        const encoding = options.encoding;
        const parentPath = path.substr(0, path.lastIndexOf("/"));
        const now2 = Date.now();
        let ctime = now2;
        const occupiedEntry = await this.dbRequest("get", [path]);
        if (occupiedEntry && occupiedEntry.type === "directory")
          throw Error("The supplied path is a directory.");
        const parentEntry = await this.dbRequest("get", [parentPath]);
        if (parentEntry === void 0) {
          const subDirIndex = parentPath.indexOf("/", 1);
          if (subDirIndex !== -1) {
            const parentArgPath = parentPath.substr(subDirIndex);
            await this.mkdir({
              path: parentArgPath,
              directory: options.directory,
              recursive: true
            });
          }
        }
        if (!encoding && !this.isBase64String(data))
          throw Error("The supplied data is not valid base64 content.");
        if (occupiedEntry !== void 0) {
          if (occupiedEntry.content instanceof Blob) {
            throw Error("The occupied entry contains a Blob object which cannot be appended to.");
          }
          if (occupiedEntry.content !== void 0 && !encoding) {
            data = btoa(atob(occupiedEntry.content) + atob(data));
          } else {
            data = occupiedEntry.content + data;
          }
          ctime = occupiedEntry.ctime;
        }
        const pathObj = {
          path,
          folder: parentPath,
          type: "file",
          size: data.length,
          ctime,
          mtime: now2,
          content: data
        };
        await this.dbRequest("put", [pathObj]);
      }
      /**
       * Delete a file from disk
       * @param options options for the file delete
       * @return a promise that resolves with the deleted file data result
       */
      async deleteFile(options) {
        const path = this.getPath(options.directory, options.path);
        const entry = await this.dbRequest("get", [path]);
        if (entry === void 0)
          throw Error("File does not exist.");
        const entries = await this.dbIndexRequest("by_folder", "getAllKeys", [IDBKeyRange.only(path)]);
        if (entries.length !== 0)
          throw Error("Folder is not empty.");
        await this.dbRequest("delete", [path]);
      }
      /**
       * Create a directory.
       * @param options options for the mkdir
       * @return a promise that resolves with the mkdir result
       */
      async mkdir(options) {
        const path = this.getPath(options.directory, options.path);
        const doRecursive = options.recursive;
        const parentPath = path.substr(0, path.lastIndexOf("/"));
        const depth = (path.match(/\//g) || []).length;
        const parentEntry = await this.dbRequest("get", [parentPath]);
        const occupiedEntry = await this.dbRequest("get", [path]);
        if (depth === 1)
          throw Error("Cannot create Root directory");
        if (occupiedEntry !== void 0)
          throw Error("Current directory does already exist.");
        if (!doRecursive && depth !== 2 && parentEntry === void 0)
          throw Error("Parent directory must exist");
        if (doRecursive && depth !== 2 && parentEntry === void 0) {
          const parentArgPath = parentPath.substr(parentPath.indexOf("/", 1));
          await this.mkdir({
            path: parentArgPath,
            directory: options.directory,
            recursive: doRecursive
          });
        }
        const now2 = Date.now();
        const pathObj = {
          path,
          folder: parentPath,
          type: "directory",
          size: 0,
          ctime: now2,
          mtime: now2
        };
        await this.dbRequest("put", [pathObj]);
      }
      /**
       * Remove a directory
       * @param options the options for the directory remove
       */
      async rmdir(options) {
        const { path, directory, recursive } = options;
        const fullPath = this.getPath(directory, path);
        const entry = await this.dbRequest("get", [fullPath]);
        if (entry === void 0)
          throw Error("Folder does not exist.");
        if (entry.type !== "directory")
          throw Error("Requested path is not a directory");
        const readDirResult = await this.readdir({ path, directory });
        if (readDirResult.files.length !== 0 && !recursive)
          throw Error("Folder is not empty");
        for (const entry2 of readDirResult.files) {
          const entryPath = `${path}/${entry2.name}`;
          const entryObj = await this.stat({ path: entryPath, directory });
          if (entryObj.type === "file") {
            await this.deleteFile({ path: entryPath, directory });
          } else {
            await this.rmdir({ path: entryPath, directory, recursive });
          }
        }
        await this.dbRequest("delete", [fullPath]);
      }
      /**
       * Return a list of files from the directory (not recursive)
       * @param options the options for the readdir operation
       * @return a promise that resolves with the readdir directory listing result
       */
      async readdir(options) {
        const path = this.getPath(options.directory, options.path);
        const entry = await this.dbRequest("get", [path]);
        if (options.path !== "" && entry === void 0)
          throw Error("Folder does not exist.");
        const entries = await this.dbIndexRequest("by_folder", "getAllKeys", [IDBKeyRange.only(path)]);
        const files = await Promise.all(entries.map(async (e) => {
          let subEntry = await this.dbRequest("get", [e]);
          if (subEntry === void 0) {
            subEntry = await this.dbRequest("get", [e + "/"]);
          }
          return {
            name: e.substring(path.length + 1),
            type: subEntry.type,
            size: subEntry.size,
            ctime: subEntry.ctime,
            mtime: subEntry.mtime,
            uri: subEntry.path
          };
        }));
        return { files };
      }
      /**
       * Return full File URI for a path and directory
       * @param options the options for the stat operation
       * @return a promise that resolves with the file stat result
       */
      async getUri(options) {
        const path = this.getPath(options.directory, options.path);
        let entry = await this.dbRequest("get", [path]);
        if (entry === void 0) {
          entry = await this.dbRequest("get", [path + "/"]);
        }
        return {
          uri: (entry === null || entry === void 0 ? void 0 : entry.path) || path
        };
      }
      /**
       * Return data about a file
       * @param options the options for the stat operation
       * @return a promise that resolves with the file stat result
       */
      async stat(options) {
        const path = this.getPath(options.directory, options.path);
        let entry = await this.dbRequest("get", [path]);
        if (entry === void 0) {
          entry = await this.dbRequest("get", [path + "/"]);
        }
        if (entry === void 0)
          throw Error("Entry does not exist.");
        return {
          name: entry.path.substring(path.length + 1),
          type: entry.type,
          size: entry.size,
          ctime: entry.ctime,
          mtime: entry.mtime,
          uri: entry.path
        };
      }
      /**
       * Rename a file or directory
       * @param options the options for the rename operation
       * @return a promise that resolves with the rename result
       */
      async rename(options) {
        await this._copy(options, true);
        return;
      }
      /**
       * Copy a file or directory
       * @param options the options for the copy operation
       * @return a promise that resolves with the copy result
       */
      async copy(options) {
        return this._copy(options, false);
      }
      async requestPermissions() {
        return { publicStorage: "granted" };
      }
      async checkPermissions() {
        return { publicStorage: "granted" };
      }
      /**
       * Function that can perform a copy or a rename
       * @param options the options for the rename operation
       * @param doRename whether to perform a rename or copy operation
       * @return a promise that resolves with the result
       */
      async _copy(options, doRename = false) {
        let { toDirectory } = options;
        const { to, from, directory: fromDirectory } = options;
        if (!to || !from) {
          throw Error("Both to and from must be provided");
        }
        if (!toDirectory) {
          toDirectory = fromDirectory;
        }
        const fromPath = this.getPath(fromDirectory, from);
        const toPath = this.getPath(toDirectory, to);
        if (fromPath === toPath) {
          return {
            uri: toPath
          };
        }
        if (isPathParent(fromPath, toPath)) {
          throw Error("To path cannot contain the from path");
        }
        let toObj;
        try {
          toObj = await this.stat({
            path: to,
            directory: toDirectory
          });
        } catch (e) {
          const toPathComponents = to.split("/");
          toPathComponents.pop();
          const toPath2 = toPathComponents.join("/");
          if (toPathComponents.length > 0) {
            const toParentDirectory = await this.stat({
              path: toPath2,
              directory: toDirectory
            });
            if (toParentDirectory.type !== "directory") {
              throw new Error("Parent directory of the to path is a file");
            }
          }
        }
        if (toObj && toObj.type === "directory") {
          throw new Error("Cannot overwrite a directory with a file");
        }
        const fromObj = await this.stat({
          path: from,
          directory: fromDirectory
        });
        const updateTime = async (path, ctime2, mtime) => {
          const fullPath = this.getPath(toDirectory, path);
          const entry = await this.dbRequest("get", [fullPath]);
          entry.ctime = ctime2;
          entry.mtime = mtime;
          await this.dbRequest("put", [entry]);
        };
        const ctime = fromObj.ctime ? fromObj.ctime : Date.now();
        switch (fromObj.type) {
          // The "from" object is a file
          case "file": {
            const file = await this.readFile({
              path: from,
              directory: fromDirectory
            });
            if (doRename) {
              await this.deleteFile({
                path: from,
                directory: fromDirectory
              });
            }
            let encoding;
            if (!(file.data instanceof Blob) && !this.isBase64String(file.data)) {
              encoding = Encoding.UTF8;
            }
            const writeResult = await this.writeFile({
              path: to,
              directory: toDirectory,
              data: file.data,
              encoding
            });
            if (doRename) {
              await updateTime(to, ctime, fromObj.mtime);
            }
            return writeResult;
          }
          case "directory": {
            if (toObj) {
              throw Error("Cannot move a directory over an existing object");
            }
            try {
              await this.mkdir({
                path: to,
                directory: toDirectory,
                recursive: false
              });
              if (doRename) {
                await updateTime(to, ctime, fromObj.mtime);
              }
            } catch (e) {
            }
            const contents = (await this.readdir({
              path: from,
              directory: fromDirectory
            })).files;
            for (const filename of contents) {
              await this._copy({
                from: `${from}/${filename.name}`,
                to: `${to}/${filename.name}`,
                directory: fromDirectory,
                toDirectory
              }, doRename);
            }
            if (doRename) {
              await this.rmdir({
                path: from,
                directory: fromDirectory
              });
            }
          }
        }
        return {
          uri: toPath
        };
      }
      isBase64String(str) {
        try {
          return btoa(atob(str)) == str;
        } catch (err) {
          return false;
        }
      }
    };
    FilesystemWeb._debug = true;
  }
});

// node_modules/@capacitor/share/dist/esm/web.js
var web_exports4 = {};
__export(web_exports4, {
  ShareWeb: () => ShareWeb
});
var ShareWeb;
var init_web4 = __esm({
  "node_modules/@capacitor/share/dist/esm/web.js"() {
    init_dist();
    ShareWeb = class extends WebPlugin {
      async canShare() {
        if (typeof navigator === "undefined" || !navigator.share) {
          return { value: false };
        } else {
          return { value: true };
        }
      }
      async share(options) {
        if (typeof navigator === "undefined" || !navigator.share) {
          throw this.unavailable("Share API not available in this browser");
        }
        await navigator.share({
          title: options.title,
          text: options.text,
          url: options.url
        });
        return {};
      }
    };
  }
});

// src/core.js
function dateKey(date = /* @__PURE__ */ new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start2 = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start2);
    d.setDate(start2.getDate() + i);
    return { key: dateKey(d), day: d.getDate(), current: d.getMonth() === month };
  });
}
function validateRecord(kind, data) {
  if (!kinds.includes(kind)) throw new Error("지원하지 않는 기록입니다.");
  const field = ["event", "post"].includes(kind) ? "title" : "text";
  if (!String(data[field] || "").trim()) throw new Error(field === "title" ? "제목을 적어 주세요." : "내용을 적어 주세요.");
  if (String(data[field]).length > (field === "title" ? 120 : 1e4)) throw new Error("내용이 너무 깁니다.");
  if (["event", "diary", "post"].includes(kind) && (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || "") || dateKey(/* @__PURE__ */ new Date(`${data.date}T12:00:00`)) !== data.date)) throw new Error("올바른 날짜를 선택해 주세요.");
  if (kind === "event" && data.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)) throw new Error("올바른 시간을 선택해 주세요.");
  if (kind === "event" && data.endDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.endDate) || dateKey(/* @__PURE__ */ new Date(`${data.endDate}T12:00:00`)) !== data.endDate || data.endDate < data.date) throw new Error("종료 날짜를 확인해 주세요.");
    if (data.time && data.endTime && /* @__PURE__ */ new Date(`${data.endDate}T${data.endTime}:00`) <= /* @__PURE__ */ new Date(`${data.date}T${data.time}:00`)) throw new Error("종료 시간은 시작 시간보다 뒤여야 합니다.");
  }
  if (kind === "comment" && !data.postId) throw new Error("게시글을 찾을 수 없습니다.");
  if (kind === "comment" && data.replyTo !== void 0 && data.replyTo !== null && (typeof data.replyTo !== "string" || !data.replyTo.trim() || data.replyTo === data.postId)) throw new Error("올바른 답글 대상을 선택해 주세요.");
  return data;
}
function nextDay(key) {
  const d = /* @__PURE__ */ new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return dateKey(d);
}
function eventOnDate(row, key) {
  const data = row.data;
  if (data.date > key) return false;
  if (data.end?.date) return key < data.end.date;
  if (data.end?.dateTime) {
    const finish = new Date(data.end.dateTime);
    return /* @__PURE__ */ new Date(`${key}T00:00:00`) < finish;
  }
  return key <= (data.endDate || data.date);
}
function googleEvent(item) {
  const start2 = item.start?.dateTime || item.start?.date;
  if (!start2 || item.status === "cancelled") return null;
  const d = item.start.dateTime ? new Date(start2) : null;
  return { id: item.id, kind: "event", author_id: item.creator?.email || "", created_at: item.created, data: { title: item.summary || "(제목 없음)", text: item.description || "", date: d ? dateKey(d) : start2, time: d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "", end: item.end, google: true } };
}
function safeFileType(file) {
  const type = file.type.toLowerCase();
  const image = /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/;
  if (!image.test(type) && !/^video\/(mp4|quicktime|webm|3gpp|x-m4v)$/.test(type)) throw new Error("사진 또는 동영상 파일만 올릴 수 있습니다.");
  if (file.size === 0) throw new Error("빈 파일은 올릴 수 없습니다.");
  return type;
}
function sortRecords(rows, order = "newest") {
  const direction = order === "oldest" ? 1 : -1;
  return [...rows].sort((a, b) => (order === "date" ? String(b.data.date).localeCompare(String(a.data.date)) : 0) || direction * ((Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0) || String(a.id).localeCompare(String(b.id))));
}
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && dateKey(/* @__PURE__ */ new Date(`${value}T12:00:00`)) === value;
}
function annualDate(year, source) {
  const candidate = `${year}${source.slice(4)}`;
  return validDate(candidate) ? candidate : `${year}-02-28`;
}
function coupleEvents(year, settings2 = {}) {
  const rows = [];
  const add = (id, title, date) => {
    if (Number(date.slice(0, 4)) === year) rows.push({ id: `couple-${id}-${year}`, kind: "event", author_id: "", data: { title, date, time: "", automatic: true } });
  };
  for (const [index, birthday] of (settings2.birthdays || []).entries()) {
    if (validDate(birthday.date) && year >= Number(birthday.date.slice(0, 4))) add(`birthday-${birthday.id || index}`, `${birthday.name || "짝꿍"} 생일`, annualDate(year, birthday.date));
  }
  if (validDate(settings2.startDate)) {
    for (const count of [100, 200, 300]) {
      const date = /* @__PURE__ */ new Date(`${settings2.startDate}T12:00:00`);
      date.setDate(date.getDate() + count - 1);
      add(`day-${count}`, `${count}일 기념일`, dateKey(date));
    }
    const years = year - Number(settings2.startDate.slice(0, 4));
    if (years > 0) add(`anniversary-${years}`, `${years}주년`, annualDate(year, settings2.startDate));
  }
  return rows.sort((a, b) => a.data.date.localeCompare(b.data.date) || a.id.localeCompare(b.id));
}
function coupleDaySummary(settings2 = {}, today2 = dateKey()) {
  const elapsed = validDate(settings2.startDate) ? daysBetween(settings2.startDate, today2) : null;
  const year = Number(today2.slice(0, 4));
  const upcoming = [...coupleEvents(year, settings2), ...coupleEvents(year + 1, settings2)].find((row) => row.data.date >= today2);
  return { elapsed, label: elapsed === null ? "" : elapsed >= 0 ? `D+${elapsed}` : `D-${-elapsed}`, upcoming: upcoming ? { ...upcoming, remaining: daysBetween(today2, upcoming.data.date), label: upcoming.data.date === today2 ? "D-Day" : `D-${daysBetween(today2, upcoming.data.date)}` } : null };
}
function koreaHolidays(year) {
  if (!HOLIDAY_YEARS.includes(year)) return [];
  const fixed = [["01-01", "신정"], ["03-01", "삼일절"], ["05-05", "어린이날"], ["06-06", "현충일"], ["08-15", "광복절"], ["10-03", "개천절"], ["10-09", "한글날"], ["12-25", "성탄절"]];
  if (year >= 2026) fixed.push(["05-01", "노동절"], ["07-17", "제헌절"]);
  const special = {
    2023: [["01-21", "설날 연휴"], ["01-22", "설날"], ["01-23", "설날 연휴"], ["01-24", "대체공휴일 (설날)"], ["05-27", "부처님오신날"], ["05-29", "대체공휴일 (부처님오신날)"], ["09-28", "추석 연휴"], ["09-29", "추석"], ["09-30", "추석 연휴"], ["10-02", "임시공휴일"]],
    2024: [["02-09", "설날 연휴"], ["02-10", "설날"], ["02-11", "설날 연휴"], ["02-12", "대체공휴일 (설날)"], ["04-10", "국회의원선거"], ["05-06", "대체공휴일 (어린이날)"], ["05-15", "부처님오신날"], ["09-16", "추석 연휴"], ["09-17", "추석"], ["09-18", "추석 연휴"], ["10-01", "임시공휴일 (국군의 날)"]],
    2025: [["01-27", "임시공휴일"], ["01-28", "설날 연휴"], ["01-29", "설날"], ["01-30", "설날 연휴"], ["03-03", "대체공휴일 (삼일절)"], ["05-05", "부처님오신날"], ["05-06", "대체공휴일 (부처님오신날)"], ["06-03", "대통령선거"], ["10-05", "추석 연휴"], ["10-06", "추석"], ["10-07", "추석 연휴"], ["10-08", "대체공휴일 (추석)"]],
    2026: [["02-16", "설날 연휴"], ["02-17", "설날"], ["02-18", "설날 연휴"], ["03-02", "대체공휴일 (삼일절)"], ["05-24", "부처님오신날"], ["05-25", "대체공휴일 (부처님오신날)"], ["06-03", "전국동시지방선거"], ["08-17", "대체공휴일 (광복절)"], ["09-24", "추석 연휴"], ["09-25", "추석"], ["09-26", "추석 연휴"], ["10-05", "대체공휴일 (개천절)"]],
    2027: [["02-06", "설날 연휴"], ["02-07", "설날"], ["02-08", "설날 연휴"], ["02-09", "대체공휴일 (설날)"], ["05-03", "대체공휴일 (노동절)"], ["05-13", "부처님오신날"], ["07-19", "대체공휴일 (제헌절)"], ["08-16", "대체공휴일 (광복절)"], ["09-14", "추석 연휴"], ["09-15", "추석"], ["09-16", "추석 연휴"], ["10-04", "대체공휴일 (개천절)"], ["10-11", "대체공휴일 (한글날)"], ["12-27", "대체공휴일 (성탄절)"]],
    2028: [["01-26", "설날 연휴"], ["01-27", "설날"], ["01-28", "설날 연휴"], ["04-12", "국회의원선거"], ["05-02", "부처님오신날"], ["10-02", "추석 연휴"], ["10-03", "추석"], ["10-04", "추석 연휴"], ["10-05", "대체공휴일 (추석)"]]
  }[year];
  return [...fixed, ...special].map(([date, title]) => ({ date: `${year}-${date}`, title })).sort((a, b) => a.date.localeCompare(b.date));
}
var kinds, escapeHtml, HOLIDAY_YEARS;
var init_core = __esm({
  "src/core.js"() {
    kinds = ["event", "diary", "post", "comment", "message"];
    escapeHtml = (v = "") => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    HOLIDAY_YEARS = [2023, 2024, 2025, 2026, 2027, 2028];
  }
});

// src/media.js
async function createThumbnail(file) {
  if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type)) return null;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve2) => canvas.toBlob(resolve2, "image/webp", 0.72));
    if (!blob || blob.size >= file.size) return null;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.preview.${blob.type === "image/webp" ? "webp" : "png"}`, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
function recordPreviewDownload(bytes, milliseconds) {
  measurements.downloads++;
  measurements.bytes += bytes;
  measurements.milliseconds += milliseconds;
}
function recordPreviewCacheHit() {
  measurements.cacheHits++;
}
function previewMeasurements() {
  return { ...measurements };
}
var previewFile, measurements;
var init_media = __esm({
  "src/media.js"() {
    previewFile = (file) => file?.thumbnail || file;
    measurements = { downloads: 0, bytes: 0, milliseconds: 0, cacheHits: 0 };
  }
});

// src/storage.js
async function db() {
  if (database) return database;
  database = await new Promise((resolve2, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("records", { keyPath: "id" });
      request.result.createObjectStore("files", { keyPath: "id" });
    };
    request.onsuccess = () => resolve2(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}
async function transaction(store, mode, action) {
  const database2 = await db();
  return new Promise((resolve2, reject) => {
    const tx = database2.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve2(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("저장하지 못했습니다."));
  });
}
var DB, database, local;
var init_storage = __esm({
  "src/storage.js"() {
    DB = "geonjukong-local-v1";
    local = {
      list: () => transaction("records", "readonly", (s2) => s2.getAll()),
      put: (row) => transaction("records", "readwrite", (s2) => s2.put(row)),
      async putIfVersion(row, version) {
        const database2 = await db();
        return new Promise((resolve2, reject) => {
          const tx = database2.transaction("records", "readwrite");
          const store = tx.objectStore("records");
          const request = store.get(row.id);
          let saved = false;
          request.onsuccess = () => {
            const current = request.result;
            if (current && (current.updated_at || current.created_at) === version) {
              store.put(row);
              saved = true;
            }
          };
          tx.oncomplete = () => resolve2(saved);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error("저장하지 못했습니다."));
        });
      },
      remove: (id) => transaction("records", "readwrite", (s2) => s2.delete(id)),
      file: (id) => transaction("files", "readonly", (s2) => s2.get(id)),
      putFile: (id, blob) => transaction("files", "readwrite", (s2) => s2.put({ id, blob })),
      async clear() {
        await transaction("records", "readwrite", (s2) => s2.clear());
        await transaction("files", "readwrite", (s2) => s2.clear());
      }
    };
  }
});

// src/platform.js
function isAuthCallback(value) {
  try {
    const url = new URL(value);
    return url.protocol === "com.geonjukong.couple:" && url.hostname === "auth" && url.pathname === "/callback" && !url.username && !url.password;
  } catch {
    return false;
  }
}
var NATIVE_CALLBACK, native;
var init_platform = __esm({
  "src/platform.js"() {
    NATIVE_CALLBACK = "com.geonjukong.couple://auth/callback";
    native = {
      async onBack(handler) {
        return this.active ? window.GEONJUKONG_NATIVE.onBack?.(handler) : void 0;
      },
      async exit() {
        if (this.active) await window.GEONJUKONG_NATIVE.exit();
      },
      get active() {
        return Boolean(window.GEONJUKONG_NATIVE?.active);
      },
      async open(url) {
        if (!this.active) throw new Error("설치형 앱에서만 사용할 수 있습니다.");
        await window.GEONJUKONG_NATIVE.open(url);
      },
      async closeBrowser() {
        if (this.active) await window.GEONJUKONG_NATIVE.closeBrowser();
      },
      async saveFile(blob, name) {
        if (!this.active) throw new Error("설치형 앱에서만 사용할 수 있습니다.");
        await window.GEONJUKONG_NATIVE.saveFile(blob, name);
      },
      async listen(handler) {
        return this.active ? window.GEONJUKONG_NATIVE.listen(handler) : void 0;
      }
    };
  }
});

// src/backend.js
function setSession(value) {
  session = value;
  if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else localStorage.removeItem(SESSION_KEY);
}
async function authRequest(path, body, generation2 = sessionGeneration) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, { method: "POST", headers: { apikey: config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.msg || data.error_description || "로그인에 실패했습니다.");
    error.status = response.status;
    throw error;
  }
  if (generation2 !== sessionGeneration) throw new Error("로그인 세션이 종료되었습니다.");
  if (data.provider_token) providerToken = data.provider_token;
  const { provider_token, provider_refresh_token, ...appSession } = data;
  setSession({ ...appSession, expires_at: Date.now() + data.expires_in * 1e3 });
  if (provider_refresh_token) {
    try {
      await googleRequest({ action: "store", refresh_token: provider_refresh_token });
      googleWarning = "";
    } catch {
      googleWarning = "Google 지속 연결을 저장하지 못했습니다. google-auth 서버 배포와 네트워크를 확인한 뒤 다시 연결해 주세요.";
    }
  }
  return data;
}
async function accessToken() {
  if (!session) throw new Error("로그인이 필요합니다.");
  if (session.expires_at < Date.now() + 6e4) {
    if (!refreshPending) {
      const generation2 = sessionGeneration;
      refreshPending = authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token }, generation2).catch((error) => {
        if (generation2 === sessionGeneration && (error.status === 400 || error.status === 401)) setSession(null);
        throw error;
      }).finally(() => {
        refreshPending = null;
      });
    }
    await refreshPending;
  }
  return session.access_token;
}
async function googleRequest(body) {
  const response = await fetch(`${config.supabaseUrl}/functions/v1/google-auth`, { method: "POST", headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Google 지속 연결 서버를 확인한 뒤 다시 연결해 주세요.");
  return data;
}
async function rest(path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { ...options, headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", Prefer: "return=representation", ...options.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "공유 서버에 연결하지 못했습니다.");
  }
  return response.status === 204 ? null : response.json();
}
var config, SESSION_KEY, configured, session, refreshPending, providerToken, googleWarning, sessionGeneration, auth, repository;
var init_backend = __esm({
  "src/backend.js"() {
    init_storage();
    init_core();
    init_platform();
    config = window.APP_CONFIG;
    SESSION_KEY = "geonjukong-auth";
    configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
    try {
      session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      session = null;
    }
    googleWarning = "";
    sessionGeneration = 0;
    auth = {
      get googleWarning() {
        return googleWarning;
      },
      async googleToken() {
        return googleRequest({ action: "token" });
      },
      get user() {
        return session?.user || null;
      },
      takeProviderToken() {
        const value = providerToken;
        providerToken = void 0;
        return value;
      },
      async callback(callbackUrl) {
        if (callbackUrl && !isAuthCallback(callbackUrl)) throw new Error("허용되지 않은 앱 로그인 주소입니다.");
        const url = new URL(callbackUrl || location.href);
        const error = url.searchParams.get("error_description");
        if (error) {
          history.replaceState(null, "", location.pathname);
          throw new Error(error);
        }
        const code = url.searchParams.get("code");
        if (!code) return;
        const storage = native.active ? localStorage : sessionStorage;
        const verifier = storage.getItem("geonjukong-pkce");
        history.replaceState(null, "", location.pathname);
        if (!verifier) throw new Error("로그인을 시작한 브라우저에서 다시 시도해 주세요.");
        await authRequest("token?grant_type=pkce", { auth_code: code, code_verifier: verifier });
        storage.removeItem("geonjukong-pkce");
        await native.closeBrowser();
      },
      async login() {
        if (!configured) throw new Error("먼저 config.js에 Supabase 공개 설정을 입력해 주세요.");
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const verifier = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        (native.active ? localStorage : sessionStorage).setItem("geonjukong-pkce", verifier);
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
        const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const url = new URL(`${config.supabaseUrl}/auth/v1/authorize`);
        url.search = new URLSearchParams({ provider: "google", redirect_to: native.active ? NATIVE_CALLBACK : `${location.origin}${location.pathname}`, code_challenge: challenge, code_challenge_method: "s256" });
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("scopes", "openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/user.birthday.read");
        url.searchParams.set("prompt", "consent");
        if (native.active) {
          await native.open(url.toString());
        } else location.assign(url);
      },
      async logout() {
        const access2 = session?.access_token;
        sessionGeneration++;
        providerToken = void 0;
        googleWarning = "";
        setSession(null);
        if (!access2) return { remote: true };
        try {
          const response = await fetch(`${config.supabaseUrl}/auth/v1/logout`, { method: "POST", headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${access2}` } });
          return { remote: response.ok };
        } catch {
          return { remote: false };
        }
      }
    };
    repository = {
      async coupleSettings() {
        const rows = await rest("couple_settings?id=eq.1&select=data");
        return rows[0]?.data || {};
      },
      async createCoupleSettings(data) {
        return rest("couple_settings?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ id: 1, data }) });
      },
      async updateCoupleDate(field, date) {
        return rest("rpc/update_couple_date", { method: "POST", body: JSON.stringify({ field, date_value: date }) });
      },
      async saveCoupleSettings(data) {
        return rest("couple_settings?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ id: 1, data }) });
      },
      async notificationReads() {
        return rest("notification_reads?select=record_id,read_at");
      },
      async markNotificationRead(userId, recordId) {
        return rest("notification_reads?on_conflict=user_id,record_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: userId, record_id: recordId, read_at: (/* @__PURE__ */ new Date()).toISOString() }) });
      },
      async markNotificationsRead(userId, recordIds) {
        return rest("notification_reads?on_conflict=user_id,record_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(recordIds.map((record_id) => ({ user_id: userId, record_id, read_at: (/* @__PURE__ */ new Date()).toISOString() }))) });
      },
      async saveCalendarNotice(userId, notice) {
        return rest("records?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ id: notice.id, author_id: userId, kind: "event_notice", data: { text: notice.title, title: notice.title, date: notice.date, eventId: notice.eventId } }) });
      },
      async members() {
        return rest("members?select=slot,email,display_name");
      },
      async list() {
        const all = [];
        let offset = 0;
        while (true) {
          const page = await rest(`records?select=*&order=created_at.asc,id.asc&limit=500&offset=${offset}`);
          all.push(...page);
          if (page.length < 500) return all;
          offset += 500;
        }
      },
      async save(mode, userId, kind, data, existingId, expectedVersion) {
        validateRecord(kind, data);
        const guardedUpdate = Boolean(existingId && kind === "post" && data.space === "board");
        const conflict = "다른 곳에서 게시글이 수정되었거나 삭제되었어요. 작성한 내용을 복사한 뒤 게시글을 다시 열어 확인해 주세요.";
        if (guardedUpdate && !expectedVersion) throw new Error(conflict);
        if (mode === "demo") {
          const records2 = await local.list();
          const old = existingId ? records2.find((r) => r.id === existingId) : null;
          if (old && (old.kind !== kind || old.data.space !== data.space)) throw new Error("기록의 종류나 공간은 바꿀 수 없습니다.");
          if (kind === "comment") {
            if (!records2.some((row3) => row3.id === data.postId && ["diary", "post"].includes(row3.kind))) throw new Error("댓글을 작성할 기록이 없습니다.");
            if (old && (old.data.postId !== data.postId || old.data.replyTo !== data.replyTo)) throw new Error("답글 대상을 바꿀 수 없습니다.");
            if (!old && data.replyTo && !records2.some((row3) => row3.id === data.replyTo && row3.kind === "comment" && row3.data.postId === data.postId && !row3.data.replyTo)) throw new Error("같은 기록의 댓글에만 답글을 작성할 수 있습니다.");
          }
          if (existingId && (!old || old.author_id !== userId && kind !== "event" && !(old.kind === "post" && old.data.space === "board" && data.space === "board"))) throw new Error("작성자만 수정할 수 있습니다.");
          const updated = guardedUpdate ? new Date(Math.max(Date.now(), Date.parse(old.updated_at || old.created_at) + 1)).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
          const row2 = { id: existingId || crypto.randomUUID(), kind, author_id: old?.author_id || userId, data, created_at: old?.created_at || (/* @__PURE__ */ new Date()).toISOString(), updated_at: updated };
          if (guardedUpdate) {
            if (!await local.putIfVersion(row2, expectedVersion)) throw new Error(conflict);
          } else await local.put(row2);
          return row2;
        }
        const row = existingId ? { data } : { kind, data, author_id: userId, parent_id: kind === "comment" ? data.postId : null };
        const filter = existingId ? `records?id=eq.${encodeURIComponent(existingId)}${guardedUpdate ? `&updated_at=eq.${encodeURIComponent(expectedVersion)}` : ""}` : "records";
        const rows = await rest(filter, { method: existingId ? "PATCH" : "POST", body: JSON.stringify(row) });
        if (!rows?.length) {
          if (guardedUpdate) {
            const visible = await rest(`records?id=eq.${encodeURIComponent(existingId)}&select=updated_at&limit=1`);
            if (visible[0]?.updated_at === expectedVersion) throw new Error("이 게시글을 수정할 권한이 없어요. 공유 공간 설정을 확인해 주세요.");
            throw new Error(conflict);
          }
          throw new Error("작성자만 수정할 수 있습니다.");
        }
        return rows[0];
      },
      async remove(mode, userId, row) {
        if (row.author_id !== userId && row.kind !== "event") throw new Error("작성자만 삭제할 수 있습니다.");
        if (mode === "demo") {
          await local.remove(row.id);
          for (const r of await local.list()) if (r.kind === "comment" && r.data.postId === row.id) await local.remove(r.id);
        } else {
          const rows = await rest(`records?id=eq.${encodeURIComponent(row.id)}`, { method: "DELETE" });
          if (!rows?.length) throw new Error("삭제할 수 없는 기록입니다.");
        }
      },
      async readAt() {
        return rest("message_reads?select=*");
      },
      async markRead(userId) {
        return rest("message_reads?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: userId, last_read_at: (/* @__PURE__ */ new Date()).toISOString() }) });
      },
      async subscribe(userId, subscription) {
        return rest("push_subscriptions?on_conflict=endpoint", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: userId, endpoint: subscription.endpoint, subscription }) });
      },
      async unsubscribe(endpoint) {
        return rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE" });
      },
      async notify(recordId) {
        if (!config.vapidPublicKey) return;
        const response = await fetch(`${config.supabaseUrl}/functions/v1/notify`, { method: "POST", headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ recordId }) });
        if (!response.ok) throw new Error("알림 서버에서 전송을 완료하지 못했습니다.");
      }
    };
  }
});

// src/google.js
function script(src) {
  if (!scripts.has(src)) scripts.set(src, new Promise((resolve2, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = resolve2;
    el.onerror = () => {
      scripts.delete(src);
      reject(new Error("Google 연결 스크립트를 불러오지 못했습니다."));
    };
    document.head.append(el);
  }));
  return scripts.get(src);
}
async function access(force = false) {
  if (!force && token && expires > Date.now()) return token;
  if (!tokenProvider) throw new Error("설정에서 Google을 연결해 주세요.");
  if (!refreshPending2) {
    const current = generation;
    refreshPending2 = Promise.resolve().then(() => tokenProvider(force)).then((result) => {
      if (current !== generation) throw new Error("Google 연결이 종료되었습니다.");
      if (!result.access_token || !(Number(result.expires_in) > 0)) throw new Error("Google을 다시 연결해 주세요.");
      token = result.access_token;
      expires = Date.now() + Math.max(0, Number(result.expires_in) - 30) * 1e3;
      return token;
    }).finally(() => {
      refreshPending2 = void 0;
    });
  }
  return refreshPending2;
}
async function authorizedFetch(url, options = {}) {
  let response = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${await access()}` } });
  if (response.status === 401) {
    token = "";
    expires = 0;
    if (tokenProvider) response = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${await access(true)}` } });
    if (response.status === 401) {
      token = "";
      expires = 0;
    }
  }
  return response;
}
async function api(url, options = {}) {
  const response = await authorizedFetch(url, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      token = "";
      expires = 0;
    }
    throw new Error(data.error?.message || `Google 요청 실패 (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}
var config2, token, expires, tokenProvider, refreshPending2, generation, uploads, scripts, eventPath, google;
var init_google = __esm({
  "src/google.js"() {
    init_core();
    init_platform();
    config2 = window.APP_CONFIG;
    token = "";
    expires = 0;
    generation = 0;
    uploads = /* @__PURE__ */ new Map();
    scripts = /* @__PURE__ */ new Map();
    eventPath = () => {
      if (!config2.calendarId) throw new Error("config.js에 공유 캘린더 ID를 입력해 주세요.");
      return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config2.calendarId)}/events`;
    };
    google = {
      setTokenProvider(provider) {
        tokenProvider = provider;
      },
      async birthday() {
        let person;
        try {
          person = await api("https://people.googleapis.com/v1/people/me?personFields=birthdays&sources=READ_SOURCE_TYPE_PROFILE");
        } catch (error) {
          throw new Error(`Google 생일을 가져오지 못했어요. 설정에서 Google을 다시 연결하고 생일 권한을 허용해 주세요. (${error.message})`);
        }
        const entries = person.birthdays || [];
        const date = (entries.find((item) => item.metadata?.primary && item.date) || entries.find((item) => item.date))?.date;
        if (!date?.year || !date.month || !date.day) throw new Error("Google 계정에서 연도까지 포함된 생일을 찾지 못했어요. Google 계정의 생일을 확인해 주세요.");
        const value = `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
        const parsed = /* @__PURE__ */ new Date(`${value}T12:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("Google 계정의 생일이 올바르지 않아요.");
        return value;
      },
      async restore() {
        await access();
        return true;
      },
      get connected() {
        return Boolean(token && (expires > Date.now() || tokenProvider));
      },
      async prepare() {
        if (!native.active && config2.googleClientId) await script("https://accounts.google.com/gsi/client");
      },
      async acceptNativeToken(value, email) {
        const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${value}` } });
        const identity = await response.json();
        if (!response.ok || !identity.email_verified || identity.email?.toLowerCase() !== email.toLowerCase()) throw new Error("Google 계정 확인에 실패했습니다. 다시 연결해 주세요.");
        token = value;
        expires = Date.now() + 50 * 60 * 1e3;
      },
      async connect(email) {
        if (!config2.googleClientId) throw new Error("config.js에 Google OAuth 클라이언트 ID를 입력해 주세요.");
        if (!window.google?.accounts) throw new Error("Google 연결을 준비 중입니다. 잠시 후 다시 눌러 주세요.");
        return new Promise((resolve2, reject) => {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: config2.googleClientId,
            scope: "openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file",
            hint: email,
            callback: async (result) => {
              if (result.error) return reject(new Error("Google 접근 동의를 완료하지 못했습니다."));
              if (!window.google.accounts.oauth2.hasGrantedAllScopes(result, "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/drive.file")) return reject(new Error("캘린더와 Drive 접근에 모두 동의해 주세요."));
              try {
                const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${result.access_token}` } });
                const identity = await response.json();
                if (!response.ok || identity.email?.toLowerCase() !== email.toLowerCase() || !identity.email_verified) throw new Error("앱에 로그인한 것과 같은 Google 계정을 선택해 주세요.");
                token = result.access_token;
                expires = Date.now() + (Number(result.expires_in) - 30) * 1e3;
                resolve2();
              } catch (error) {
                reject(error);
              }
            },
            error_callback: () => reject(new Error("Google 연결 창이 닫혔습니다. 다시 시도해 주세요."))
          });
          client.requestAccessToken({ prompt: "select_account" });
        });
      },
      disconnect() {
        generation++;
        token = "";
        expires = 0;
        uploads.clear();
      },
      async events(year, month) {
        const min = new Date(year, month, -7);
        const max = new Date(year, month + 1, 14);
        const params = new URLSearchParams({ timeMin: min.toISOString(), timeMax: max.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
        const all = [];
        let next;
        do {
          if (next) params.set("pageToken", next);
          const result = await api(`${eventPath()}?${params}`);
          all.push(...(result.items || []).map(googleEvent).filter(Boolean));
          next = result.nextPageToken;
        } while (next);
        return all;
      },
      async upcomingEvents(today2 = dateKey()) {
        const min = /* @__PURE__ */ new Date(`${today2}T00:00:00`);
        const params = new URLSearchParams({ timeMin: min.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
        const all = [];
        let next;
        do {
          if (next) params.set("pageToken", next);
          const result = await api(`${eventPath()}?${params}`);
          all.push(...(result.items || []).map(googleEvent).filter((row) => row && row.data.date >= today2));
          next = result.nextPageToken;
        } while (next && all.length < 3);
        return all.slice(0, 3);
      },
      async event(id) {
        return googleEvent(await api(`${eventPath()}/${encodeURIComponent(id)}`));
      },
      async saveEvent(data, id) {
        let start2, end;
        if (data.time) {
          const begin = /* @__PURE__ */ new Date(`${data.date}T${data.time}:00`);
          const finish = data.endDate && data.endTime ? /* @__PURE__ */ new Date(`${data.endDate}T${data.endTime}:00`) : new Date(begin.getTime() + 36e5);
          if (finish <= begin) throw new Error("종료 시간은 시작 시간보다 뒤여야 합니다.");
          start2 = { dateTime: begin.toISOString() };
          end = { dateTime: finish.toISOString() };
        } else {
          start2 = { date: data.date };
          end = { date: data.endDate ? nextDay(data.endDate) : nextDay(data.date) };
          if (end.date <= data.date) throw new Error("종료 날짜를 확인해 주세요.");
        }
        return api(`${eventPath()}${id ? `/${encodeURIComponent(id)}` : ""}`, { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: data.title, description: data.text || "", start: start2, end }) });
      },
      async deleteEvent(id) {
        await api(`${eventPath()}/${encodeURIComponent(id)}`, { method: "DELETE" });
      },
      async pickFolder() {
        await access();
        if (!config2.googleApiKey || !config2.googleProjectNumber) throw new Error("Google Picker용 API 키와 프로젝트 번호를 config.js에 입력해 주세요.");
        await script("https://apis.google.com/js/api.js");
        await new Promise((resolve2, reject) => window.gapi.load("picker", { callback: resolve2, onerror: () => reject(new Error("폴더 선택기를 불러오지 못했습니다.")) }));
        return new Promise((resolve2, reject) => {
          const pickerApi = window.google.picker;
          const view = new pickerApi.DocsView(pickerApi.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true);
          new pickerApi.PickerBuilder().addView(view).setOAuthToken(token).setDeveloperKey(config2.googleApiKey).setAppId(config2.googleProjectNumber).setOrigin(location.origin).setCallback((result) => {
            if (result.action === pickerApi.Action.PICKED) resolve2(result.docs[0]);
            if (result.action === pickerApi.Action.CANCEL) reject(new Error("폴더 선택을 취소했습니다."));
          }).build().setVisible(true);
        });
      },
      async pickPhoto(id) {
        await access();
        if (!config2.googleApiKey || !config2.googleProjectNumber) throw new Error("사진 선택을 위해 Google Picker API 키와 프로젝트 번호를 설정해 주세요.");
        await script("https://apis.google.com/js/api.js");
        await new Promise((resolve2, reject) => window.gapi.load("picker", { callback: resolve2, onerror: () => reject(new Error("사진 선택기를 불러오지 못했어요.")) }));
        return new Promise((resolve2, reject) => {
          const pickerApi = window.google.picker;
          const view = new pickerApi.DocsView(pickerApi.ViewId.DOCS).setFileIds(id);
          new pickerApi.PickerBuilder().addView(view).setOAuthToken(token).setDeveloperKey(config2.googleApiKey).setAppId(config2.googleProjectNumber).setOrigin(location.origin).setTitle("미리 볼 사진을 선택해 주세요").setCallback((result) => {
            if (result.action === pickerApi.Action.PICKED) {
              if (result.docs?.some((file) => file.id === id)) resolve2();
              else reject(new Error("해당 사진을 선택해 주세요."));
            }
            if (result.action === pickerApi.Action.CANCEL) reject(new Error("사진 선택을 취소했어요."));
          }).build().setVisible(true);
        });
      },
      async checkFolder() {
        if (!config2.driveFolderId) throw new Error("config.js에 공유 Drive 폴더 ID를 입력해 주세요.");
        const folder = await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(config2.driveFolderId)}?fields=id,name,mimeType,capabilities(canAddChildren)`);
        if (folder.mimeType !== "application/vnd.google-apps.folder" || !folder.capabilities?.canAddChildren) throw new Error("선택한 공유 폴더에 업로드 권한이 없습니다.");
        return folder;
      },
      async image(id, signal) {
        const response = await authorizedFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { signal });
        if (!response.ok) {
          if (response.status === 401) {
            token = "";
            expires = 0;
          }
          const error = new Error("Drive 사진을 불러오지 못했어요. Google 연결과 파일 권한을 확인해 주세요.");
          error.status = response.status;
          if (response.status === 403) {
            const details = await response.json().catch(() => ({}));
            if (details.error?.errors?.some((item) => ["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded"].includes(item.reason))) error.code = "rate_limit";
          }
          throw error;
        }
        const blob = await response.blob();
        if (!/^image\/(jpeg|png|webp|gif|heic|heif|avif)$/i.test(blob.type) || !blob.size) {
          const error = new Error("미리볼 수 있는 사진이 아니에요. 원본 열기를 이용해 주세요.");
          error.code = "invalid_image";
          throw error;
        }
        return blob;
      },
      async upload(file, progress) {
        safeFileType(file);
        await access();
        if (!config2.driveFolderId) throw new Error("공유 Drive 폴더를 먼저 설정해 주세요.");
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        let upload = uploads.get(key);
        if (!upload) {
          const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink", { method: "POST", headers: { Authorization: `Bearer ${await access()}`, "Content-Type": "application/json", "X-Upload-Content-Type": file.type, "X-Upload-Content-Length": String(file.size) }, body: JSON.stringify({ name: file.name, parents: [config2.driveFolderId] }) });
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || "Drive 업로드를 시작하지 못했습니다.");
          }
          const url = response.headers.get("Location");
          if (!url) throw new Error("업로드 세션을 받지 못했습니다.");
          upload = { url, offset: 0 };
          uploads.set(key, upload);
        } else {
          const status = await fetch(upload.url, { method: "PUT", headers: { Authorization: `Bearer ${await access()}`, "Content-Range": `bytes */${file.size}` } });
          if (status.ok) {
            uploads.delete(key);
            const result = await status.json();
            return { ...result, source: "drive", type: file.type, size: file.size };
          }
          if (status.status !== 308) {
            uploads.delete(key);
            throw new Error("업로드 세션이 만료되었습니다. 다시 저장해 주세요.");
          }
          upload.offset = Number(status.headers.get("Range")?.split("-")[1] ?? -1) + 1;
        }
        while (upload.offset < file.size) {
          const end = Math.min(upload.offset + 4 * 1024 * 1024, file.size);
          const response = await fetch(upload.url, { method: "PUT", headers: { Authorization: `Bearer ${await access()}`, "Content-Type": file.type, "Content-Range": `bytes ${upload.offset}-${end - 1}/${file.size}` }, body: file.slice(upload.offset, end) });
          if (response.status === 308) {
            upload.offset = Number(response.headers.get("Range")?.split("-")[1] ?? end - 1) + 1;
            progress(Math.round(upload.offset / file.size * 100));
            continue;
          }
          if (!response.ok) throw new Error("업로드가 중단되었습니다. 화면을 유지한 채 다시 저장하면 이어서 전송합니다.");
          const result = await response.json();
          uploads.delete(key);
          progress(100);
          return { ...result, source: "drive", type: file.type, size: file.size };
        }
        throw new Error("업로드 완료를 확인하지 못했습니다. 다시 저장해 주세요.");
      },
      async openFile(id) {
        const url = `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
        if (native.active) await native.open(url);
        else window.open(url, "_blank", "noopener,noreferrer");
      }
    };
  }
});

// src/app.js
var app_exports = {};
function queueCalendarNotice(user, event, data) {
  const key = pendingKey(user), pending = JSON.parse(localStorage.getItem(key) || "[]");
  pending.push({ id: crypto.randomUUID(), eventId: event.id, title: data.title, date: data.date });
  localStorage.setItem(key, JSON.stringify(pending));
}
async function flushCalendarNotices(user) {
  if (pendingNotices.has(user)) return pendingNotices.get(user);
  const job = (async () => {
    const key = pendingKey(user);
    for (const notice of JSON.parse(localStorage.getItem(key) || "[]")) {
      await repository.saveCalendarNotice(user, notice);
      const remaining = JSON.parse(localStorage.getItem(key) || "[]").filter((item) => item.id !== notice.id);
      if (remaining.length) localStorage.setItem(key, JSON.stringify(remaining));
      else localStorage.removeItem(key);
    }
  })().finally(() => pendingNotices.delete(user));
  pendingNotices.set(user, job);
  return job;
}
async function updatePendingNotices(user) {
  try {
    await flushCalendarNotices(user);
    if (state.mode === "live" && state.user === user) state.noticeError = "";
  } catch {
    if (state.mode === "live" && state.user === user) state.noticeError = "일정은 저장됐지만 상대방에게 알림을 전달하지 못했어요. 연결을 확인하면 다시 시도해요.";
  }
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 4200);
}
function report(error) {
  console.error(error.message);
  toast(error.message || "작업을 완료하지 못했습니다.");
}
function empty(title, text, action = "") {
  return `<div class="empty">${icon("heart")}<h3>${title}</h3><p>${text}</p>${action}</div>`;
}
function scene() {
  return `<svg class="together-art" viewBox="0 0 440 250" fill="none" aria-hidden="true"><circle cx="310" cy="62" r="39" fill="#efcf95"/><path d="M1 190c87-80 143-13 229-40 83-26 120-10 211 40v60H1Z" fill="#ccd2b5"/><path d="M0 221c89-21 112-53 196-26 82 26 171-41 244-1v56H0Z" fill="#93aa8b"/><path d="M327 189v-76m-17 30 17 13 18-24" stroke="#526c4f" stroke-width="3"/><ellipse cx="327" cy="106" rx="30" ry="45" fill="#6f8b66"/><path d="M106 206c-3-37 7-77 37-77s40 40 37 77" fill="#faf2dc"/><path d="M168 210c-3-30 4-64 30-64s36 34 34 64" fill="#d9a385"/><path d="M111 173c11-8 21-8 31-2m42 10c8-6 17-6 24-1" stroke="#536044" stroke-width="2" stroke-linecap="round"/><path d="m137 184 8 4-8 4m68-1 7 4-7 4" fill="#dba758"/><path d="M87 217c33-6 91 2 146-2" stroke="#647c54" stroke-width="3" stroke-linecap="round"/><path d="m242 109 5 6 5-6c12-14-17-20-10 0Z" fill="#bc715d"/><path d="M41 66c17-17 34-17 51 0m269-35c12-12 24-12 36 0" stroke="#a3ad91" stroke-width="2" stroke-linecap="round"/></svg>`;
}
function unread() {
  const own = state.reads.find((r) => r.user_id === state.user)?.last_read_at || "";
  return records("message").filter((r) => r.author_id !== state.user && r.created_at > own).length;
}
function render() {
  today = dateKey();
  const count = unread();
  $("#app").innerHTML = `<aside class="sidebar"><a class="brand" href="#home" data-view="home" aria-label="GeonJuKong 홈">${icon("heart")}<span>GeonJuKong<small>JUST THE TWO OF US</small></span></a><div class="sidebar-caption">우리의 작은 공간</div><nav aria-label="주 메뉴">${Object.entries(navigation).map(([view, glyph]) => `<button class="nav-item ${state.view === view ? "active" : ""}" data-view="${view}" ${state.view === view ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${labels[view]}</span>${view === "chat" && count ? `<b class="badge">${count}</b>` : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="pair-avatars">${avatar(state.user)}${avatar(state.user === "demo-me" ? "demo-partner" : "other")}</div><strong>우리 둘이면 충분해</strong><span>작은 순간도 오래도록.</span><div class="tiny-flower">✳</div></div></aside>
  <main><header class="topbar home-topbar"><div class="topbar-right"><button class="icon-button notification-button" data-action="notice-list" aria-label="알림${notices().some((r) => !noticeRead(r.id)) ? ", 읽지 않은 알림 있음" : ", 모두 읽음"}">${icon("bell")}${notices().some((r) => !noticeRead(r.id)) ? '<i class="notification-dot"></i>' : ""}</button></div></header><div class="page">${state.view === "home" ? "" : demoBanner()}${state.error ? `<div class="error-banner" role="alert">${escapeHtml(state.error)} <button data-action="refresh">다시 시도</button></div>` : ""}${state.noticeError ? `<div class="error-banner" role="alert">${escapeHtml(state.noticeError)} <button data-action="refresh">다시 시도</button></div>` : ""}${state.mode === "live" && auth.googleWarning ? `<div class="error-banner" role="alert">${escapeHtml(auth.googleWarning)} <button data-view="settings">연결 설정</button></div>` : ""}${views[state.view]()}</div><footer class="footer">GeonJuKong <span>소중한 건, 함께한 시간.</span><span class="footer-heart">♡</span></footer></main>`;
  hydrateMedia();
  if (state.view === "chat") {
    const list = $("#messages");
    if (list) list.scrollTop = list.scrollHeight;
  }
}
function pageTitle(eyebrow, title, description, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${description}</p></div>${action}</div>`;
}
function eventRows(list) {
  return list.map((row) => `<div class="event-row"><span class="event-time">${escapeHtml(row.data.time || "하루 종일")}</span><span class="event-line"></span><div><strong>${escapeHtml(postTitle(row))}</strong>${row.data.text ? `<p>${escapeHtml(row.data.text)}</p>` : ""}</div>${row.data.automatic ? '<span class="tag">자동 기념일</span>' : `<button class="icon-button" data-action="edit-event" data-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(postTitle(row))} 일정 보기">${icon("right")}</button>`}</div>`).join("");
}
function home() {
  const anniversary = coupleDaySummary(state.couple, today);
  const year = Number(today.slice(0, 4));
  const upcoming = [...state.mode === "demo" ? records("event") : state.upcomingEvents, ...coupleEvents(year, state.couple), ...coupleEvents(year + 1, state.couple)].filter((r) => r.data.date >= today).sort((a, b) => `${a.data.date}${a.data.time}`.localeCompare(`${b.data.date}${b.data.time}`)).slice(0, 3);
  const recentPosts = sortRecords(memoriesRows()).slice(0, 2);
  const latestDiary = sortRecords(records("diary"))[0];
  return `<section class="card anniversary-card"><strong>${anniversary.label || "우리의 기념일"}</strong><span>${anniversary.upcoming ? `${escapeHtml(anniversary.upcoming.data.title)} · ${anniversary.upcoming.label}` : "설정에서 연애 시작일과 생일을 등록해 주세요."}</span></section>${state.mode === "demo" ? demoBanner() : ""}${pageTitle("A DAY WITH YOU", "오늘도, 단둘이", `${formatDate(today)} · 평범한 하루도 우리에겐 특별하니까.`)}${state.mode === "live" && state.upcomingError ? `<div class="error-banner" role="alert">다가오는 일정 동기화 실패: ${escapeHtml(state.upcomingError)} <button data-action="calendar-retry">다시 시도</button></div>` : ""}<section class="hero"><div class="hero-copy"><span class="pill">OUR DAYS, OUR STORY</span><h2>같이 보낸 하루가<br>우리의 이야기가 돼.</h2><p>약속을 나누고, 마음을 적고,<br>오래 기억하고 싶은 순간을 모아요.</p>${addButton("post", "오늘의 순간 남기기")}</div>${scene()}<span class="hero-note">a little moment, a lasting memory</span></section>
  <div class="home-grid"><section class="card schedule-card"><div class="section-heading"><h2>${icon("calendar")}다가오는 약속</h2><button class="text-button" data-view="calendar">캘린더 ${icon("right")}</button></div>${state.mode === "live" && !google.connected ? empty("일정을 연결해 볼까요?", "설정에서 Google을 연결하면 공유 일정이 보여요.") : upcoming.length ? upcoming.map((r) => `<div class="upcoming-date">${formatDate(r.data.date)}${eventRows([r])}</div>`).join("") : empty("아직 정해진 약속이 없어요", "함께하고 싶은 하루를 남겨 보세요.", addButton("event", "약속 추가", "secondary"))}</section>
  <section class="card diary-card"><div class="section-heading"><h2>${icon("book")}마음을 꺼내는 시간</h2><span class="tag">둘에게 공개</span></div>${latestDiary ? `<p class="diary-quote">“${escapeHtml(latestDiary.data.text.slice(0, 115))}${latestDiary.data.text.length > 115 ? "…" : ""}”</p><div class="byline">${avatar(latestDiary.author_id, true)}<span>${escapeHtml(nameOf(latestDiary.author_id))} · ${formatDate(latestDiary.data.date, { month: "long", day: "numeric" })}</span></div>` : `<p class="diary-quote">오늘은 어떤 마음이었나요?<br>서로의 하루를 조금 더 가까이.</p>`}<button class="text-button diary-link" data-view="memories">우리의 일기 펼치기 ${icon("arrow")}</button></section></div>
  <section class="memories-section"><div class="section-heading"><h2>차곡차곡, 우리의 순간</h2><button class="text-button" data-view="memories">모두 보기 ${icon("right")}</button></div><div class="memory-grid">${recentPosts.length ? recentPosts.map(postCard).join("") : empty("첫 번째 추억을 기다려요", "사진 한 장과 짧은 이야기로 시작해 보세요.", addButton("post", "추억 남기기"))}</div></section>`;
}
function calendar() {
  const grid = monthGrid(state.year, state.month);
  const items = events();
  const holidays = [...new Set(grid.map((d) => Number(d.key.slice(0, 4))))].flatMap(koreaHolidays);
  const dayEvents = items.filter((r) => eventOnDate(r, state.day)).sort((a, b) => (a.data.time || "").localeCompare(b.data.time || ""));
  const dayDiaries = records("diary").filter((r) => r.data.date === state.day);
  const dayPosts = records("post").filter((r) => r.data.date === state.day);
  const syncStatus = state.mode === "live" && state.calendarError ? `<div class="error-banner" role="alert">Google 캘린더 동기화 실패: ${escapeHtml(state.calendarError)} <button data-action="calendar-retry">다시 시도</button> <button data-view="settings">연결 설정</button></div>` : "";
  return `${syncStatus}${pageTitle("OUR SHARED DAYS", "함께 채우는 달력", "약속도, 마음도. 같은 날짜에 나란히.", addButton("event", "약속 추가"))}<div class="calendar-layout"><section class="card calendar-card"><div class="month-heading"><h2>${state.year}년 <strong>${state.month + 1}월</strong></h2><div><button class="text-button" data-action="today">오늘</button><button class="icon-button" data-action="month" data-offset="-1" aria-label="이전 달">${icon("left")}</button><button class="icon-button" data-action="month" data-offset="1" aria-label="다음 달">${icon("right")}</button></div></div><div class="calendar-week">${["일", "월", "화", "수", "목", "금", "토"].map((d) => `<span>${d}</span>`).join("")}</div><div class="calendar-grid">${grid.map((d) => {
    const ev = items.filter((r) => eventOnDate(r, d.key));
    const holiday = holidays.filter((h) => h.date === d.key).map((h) => h.title).join(", ");
    const red = (/* @__PURE__ */ new Date(`${d.key}T12:00:00`)).getDay() === 0 || holiday;
    const diary = records("diary").some((r) => r.data.date === d.key);
    return `<button class="calendar-day ${red ? "holiday" : ""} ${d.current ? "" : "outside"} ${d.key === state.day ? "selected" : ""} ${d.key === today ? "today" : ""}" data-action="day" data-date="${d.key}" title="${escapeHtml(holiday)}" aria-label="${formatDate(d.key)} ${escapeHtml(holiday)} 일정 ${ev.length}개${diary ? ", 일기 있음" : ""}" aria-pressed="${d.key === state.day}"><span>${d.day}</span><div class="day-markers">${holiday ? `<small class="holiday-name">${escapeHtml(holiday)}</small>` : ""}${ev.slice(0, 2).map((r) => `<small>${escapeHtml(r.data.title)}</small>`).join("")}${ev.length > 2 ? `<small>+${ev.length - 2}</small>` : ""}${diary ? '<i class="diary-dot"></i>' : ""}</div></button>`;
  }).join("")}</div><p class="setting-hint">${state.year === 2028 ? "2028년 공휴일은 사전 자료로 변경될 수 있어요." : HOLIDAY_YEARS.includes(state.year) ? "대한민국 공휴일 · 임시공휴일 추가 지정은 자료 업데이트가 필요해요." : "공휴일 자료는 2023~2028년 제공해요."}</p><div class="calendar-legend"><span><i></i>우리의 일정</span><span><i></i>우리의 일기</span>${state.mode === "live" ? "<span>Google Calendar</span>" : "<span>체험 캘린더</span>"}</div></section><aside class="card date-detail"><p class="eyebrow">ON THIS DAY</p><h2>${formatDate(state.day)}</h2><p class="holiday-name">${escapeHtml(holidays.filter((h) => h.date === state.day).map((h) => h.title).join(", "))}</p><h3>우리의 약속 <span>${dayEvents.length}</span></h3>${dayEvents.length ? eventRows(dayEvents) : '<p class="muted">아직 약속이 없는 날이에요.</p>'}<button class="full-width secondary" data-action="new" data-kind="event">${icon("plus")}이날 약속 추가</button><div class="divider"></div><h3>이날의 일기 <span>${dayDiaries.length}</span></h3>${dayDiaries.map((r) => `<div class="day-diary">${avatar(r.author_id, true)}<p>${escapeHtml(r.data.text.slice(0, 100))}</p></div>`).join("") || '<p class="muted">짧은 마음 한 줄을 남겨 볼까요?</p>'}<button class="text-button" data-action="new" data-kind="diary">${icon("plus")}일기 쓰기</button>${dayPosts.length ? `<div class="divider"></div><h3>이날의 추억</h3>${dayPosts.map((r) => `<button class="text-button" data-action="open-post" data-id="${r.id}">${escapeHtml(r.data.title)} ${icon("right")}</button>`).join("")}` : ""}</aside></div>`;
}
function drivePhoto(file, alt, allowAccess = false) {
  const original = file;
  file = previewFile(file);
  return `<div class="photo-preview"><div class="file-cover">${icon("photo")}<span data-preview-status>${google.connected ? "사진을 불러오는 중…" : "Google 연결 후 사진을 볼 수 있어요."}</span><small>${escapeHtml(original.name)}</small>${allowAccess ? `<button class="secondary" data-action="photo-access" data-id="${escapeHtml(original.id)}" data-photo-access hidden>사진 접근 허용</button>` : ""}</div><img data-drive-file="${escapeHtml(file.id)}"${file.id !== original.id ? ` data-drive-original="${escapeHtml(original.id)}"` : ""} alt="${escapeHtml(alt)}" decoding="async" hidden></div>`;
}
function postCard(row) {
  const files = row.data.files || [];
  const slides = files.length ? files : [null];
  return `<article class="memory-card"><div class="memory-cover memory-gallery"><div class="memory-slides" aria-label="첨부 파일 미리보기" tabindex="0">${slides.map((originalFile) => {
    const file = previewFile(originalFile);
    return `<button class="memory-slide" data-action="open-post" data-id="${row.id}" aria-label="${escapeHtml(postTitle(row))} 게시글 열기">${file ? file.type.startsWith("image/") ? file.source === "local" ? `<img data-file="${escapeHtml(file.id)}" alt="${escapeHtml(file.name)}" loading="lazy">` : drivePhoto(originalFile, file.name) : `<div class="file-cover">${icon(file.type.startsWith("video/") ? "photo" : "cloud")}<span>${file.type.startsWith("video/") ? "우리의 영상" : "Drive에 보관한 순간"}</span><small>${escapeHtml(file.name)}</small></div>` : `<div class="paper-drawing">${icon("heart")}<span>${row.data.art === "walk" ? "a walk with you" : "little things, big love"}</span><div class="drawing-hills"></div></div>`}</button>`;
  }).join("")}</div>${files.length > 1 ? `<button type="button" class="memory-arrow memory-prev" data-action="attachment-prev" aria-label="이전 사진 또는 동영상" disabled>${icon("left")}</button><button type="button" class="memory-arrow memory-next" data-action="attachment-next" aria-label="다음 사진 또는 동영상">${icon("right")}</button><span class="file-count attachment-position" aria-live="polite">1 / ${files.length}</span>` : ""}</div><div class="memory-info"><p class="memory-date">${formatDate(row.data.date, { year: "numeric", month: "2-digit", day: "2-digit" })}</p><button class="title-button" data-action="open-post" data-id="${row.id}"><h3>${escapeHtml(postTitle(row))}</h3></button><p class="memory-excerpt">${escapeHtml(row.data.text || "함께한 순간을 간직해요.")}</p><div class="memory-meta"><span>${avatar(row.author_id, true)}${escapeHtml(nameOf(row.author_id))}</span><span>${icon("chat")}${records("comment").filter((c) => c.data.postId === row.id).length}</span></div></div></article>`;
}
function memories() {
  const list = sorted(memoriesRows()).filter((r) => `${r.data.title} ${r.data.text}`.toLowerCase().includes(state.filter.toLowerCase()));
  return `${pageTitle("COLLECTING LITTLE MOMENTS", "우리의 일기", "사진과 일기를 날짜별로 함께 보관해요.", addButton("post", "추억·일기 쓰기"))}<div class="list-toolbar"><span>소중한 순간 <strong>${memoriesRows().length}</strong></span>${orderControl()}<form id="search-form" class="search">${icon("search")}<input name="search" aria-label="추억 검색" placeholder="어떤 순간을 찾고 있나요?" value="${escapeHtml(state.filter)}"><button type="submit" class="text-button">검색</button></form></div><div class="memory-grid all-memories">${list.length ? list.map(postCard).join("") : empty(state.filter ? "찾는 추억이 없어요" : "첫 추억을 남겨 보세요", state.filter ? "다른 단어로 찾아보세요." : "사진, 동영상과 함께 우리의 이야기를 보관해요.", state.filter ? "" : addButton("post", "추억 남기기"))}</div>`;
}
function chat() {
  const list = records("message").sort((a, b) => a.created_at.localeCompare(b.created_at));
  let day = "";
  const partnerRead = state.reads.find((r) => r.user_id !== state.user)?.last_read_at || "";
  return `${pageTitle("JUST BETWEEN US", "둘만의 대화", "별것 아닌 이야기라도, 너라서 좋아.")}<section class="card chat-card"><div class="chat-header"><div class="pair-avatars">${avatar(state.user, true)}${avatar(state.user === "demo-me" ? "demo-partner" : "other", true)}</div><div><strong>우리 둘의 이야기</strong><p>${state.mode === "demo" ? "체험 대화 · 실제 상대에게 전송되지 않아요" : "5초마다 새 메시지 확인 · 잠금 화면 알림은 설정 필요"}</p></div></div><div id="messages" class="messages" aria-label="대화 기록" aria-live="polite">${list.map((r) => {
    const key = dateKey(new Date(r.created_at));
    const separator = day !== key ? `<div class="chat-date">${formatDate(key)}</div>` : "";
    day = key;
    const own = r.author_id === state.user;
    return `${separator}<div class="message ${own ? "own" : ""}">${own ? "" : avatar(r.author_id, true)}<div>${own ? "" : `<span class="message-name">${escapeHtml(nameOf(r.author_id))}</span>`}<div class="bubble">${escapeHtml(r.data.text)}</div><span class="message-time">${timeOf(r.created_at)} ${own ? r.created_at <= partnerRead ? "· 읽음" : "· 전송됨" : ""}</span></div></div>`;
  }).join("") || empty("첫 인사를 건네 보세요", "둘만의 대화가 여기 쌓일 거예요.")}</div><form id="chat-form" class="chat-compose"><textarea name="message" rows="1" maxlength="10000" placeholder="너에게 하고 싶은 말…" aria-label="메시지" required></textarea><button class="primary icon-button" type="submit" aria-label="메시지 보내기">${icon("send")}</button></form></section>`;
}
function coupleDateFields(name, label, value = "") {
  return `<label>${label}<input type="date" name="${name}" value="${escapeHtml(value)}" required></label>`;
}
function coupleDateValue(values, name, label) {
  const value = values[name] || "";
  const parsed = /* @__PURE__ */ new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value.startsWith("0000")) throw new Error(`${label}에 올바른 날짜를 선택해 주세요.`);
  return value;
}
function openCoupleSetup() {
  dialog("우리의 기념일을 알려 주세요", `<p class="setting-hint">연애 시작일을 달력에서 선택해 주세요. 생일은 각자 로그인한 뒤 설정에서 Google 계정으로 가져올 수 있어요.</p><form id="couple-setup-form">${coupleDateFields("startDate", "연애 시작일")}<p class="setting-hint">100일은 시작일을 포함해 계산해요.</p><p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary" data-action="close">나중에 설정</button><button type="submit" class="primary">저장하고 시작</button></div></form>`);
}
function settings() {
  const metrics = previewMeasurements();
  const birthday = (index) => state.couple.birthdays?.[index] || {};
  const cfg = window.APP_CONFIG;
  return `${pageTitle("MAKE OURSELVES AT HOME", "우리의 공간 설정", "연결은 간단하게, 소중한 기록은 안전하게.")}<div class="settings-grid"><section class="card settings-card"><h2>생일과 기념일</h2><form id="couple-form">${coupleDateFields("startDate", "연애 시작일", state.couple.startDate)}<p class="setting-hint">100일은 시작일을 포함해 계산해요. 2월 29일 생일은 평년에 2월 28일로 표시해요.</p><p class="form-error" role="alert"></p><button class="primary" type="submit">연애 시작일 저장</button></form><div class="divider"></div>${[0, 1].map((i) => {
    const item = birthday(i);
    return `<p>${escapeHtml(item.name || state.members.find((m) => m.slot === i + 1)?.display_name || (i === 0 ? "나" : "짝꿍"))}: ${item.date ? escapeHtml(item.date) : "아직 가져오지 않았어요"}</p>`;
  }).join("")}${state.mode === "live" ? '<button class="secondary" data-action="sync-birthday">내 Google 생일 가져오기</button><p class="setting-hint">두 사람 각각 로그인해 자신의 생일을 가져와 주세요. 생일은 두 사람에게 공유돼요.</p>' : '<p class="setting-hint">Google 생일은 로그인 후 가져올 수 있어요.</p>'}</section><section class="card settings-card"><h2>사진 미리보기 사용량</h2><p>이번 실행: ${metrics.downloads}회 · ${(metrics.bytes / 1024).toFixed(1)} KiB · ${(metrics.milliseconds / 1e3).toFixed(2)}초</p><p>메모리 캐시 재사용 ${metrics.cacheHits}회</p><p class="setting-hint">새 사진은 원본과 작은 미리보기를 함께 보관해요. 기존 사진은 원본을 사용해요. 전송량은 내려받은 이미지 본문 크기이며 통신 헤더는 제외해요.</p></section><section class="card settings-card"><div class="section-heading"><h2>${icon("heart")}우리의 계정</h2><span class="tag">${state.mode === "demo" ? "체험 중" : "연결됨"}</span></div><p>${state.mode === "demo" ? "지금은 이 브라우저에서 기능을 체험하고 있어요. 체험 기록과 실제 공유 기록은 따로 보관해요." : `${escapeHtml(auth.user?.email)} 계정으로 로그인했어요. 서버에서 허용한 두 계정만 기록을 볼 수 있어요.`}</p>${state.mode === "demo" ? `<button class="primary" data-action="login">Google로 로그인</button><p class="setting-hint">${configured ? "설정된 Supabase에 로그인합니다." : "먼저 README의 안내에 따라 config.js와 서버를 설정해 주세요."}</p><div class="divider"></div><label for="demo-person">체험할 사람</label><select id="demo-person"><option value="demo-me" ${state.user === "demo-me" ? "selected" : ""}>나</option><option value="demo-partner" ${state.user === "demo-partner" ? "selected" : ""}>짝꿍</option></select><p class="setting-hint">상대방으로 바꿔 댓글과 메시지, 작성자 권한을 확인할 수 있어요.</p>` : `<button class="secondary" data-action="logout">${icon("logout")}로그아웃</button>`}</section>
  <section class="card settings-card"><div class="section-heading"><h2>${icon("calendar")}Google 연결</h2><span class="tag">${google.connected ? "연결됨" : "연결 전"}</span></div><p>공유 캘린더의 일정을 함께 관리하고, 사진과 영상의 원본을 Drive에 보관해요.</p><button class="primary" data-action="google-connect">${icon("cloud")}${google.connected ? "Google 다시 연결" : "Google 연결하기"}</button><div class="status-list"><span>공유 캘린더 ID <b>${cfg.calendarId ? "설정됨" : "설정 필요"}</b></span><span>공유 Drive 폴더 <b>${cfg.driveFolderId ? "설정됨" : "설정 필요"}</b></span><span>폴더 접근 확인 <button class="text-button" data-action="pick-folder">폴더 선택</button></span></div><p class="setting-hint">두 사람 모두 같은 폴더를 선택해 접근을 허용해야 해요. 권한을 허용하면 인증을 자동 갱신해요. 권한이 취소된 경우 다시 연결해 주세요.</p></section>
  <section class="card settings-card"><div class="section-heading"><h2>${icon("home")}${native.active ? "설치형 GeonJuKong 앱" : "홈 화면에 설치"}</h2></div>${native.active ? '<p>휴대폰에 설치한 GeonJuKong 앱을 사용 중이에요. 앱 화면은 기기에 포함되어 있어 별도 웹페이지를 열지 않아도 돼요.</p><p class="setting-hint">공유 기록과 Google 연동에는 인터넷 연결이 필요해요. 새 버전은 새 설치 파일로 업데이트해 주세요.</p>' : '<p><strong>아이폰 14</strong><br>Safari에서 열기 → 공유 메뉴 → 홈 화면에 추가</p><p><strong>갤럭시 S23 울트라</strong><br>Chrome 메뉴 → 홈 화면에 추가 또는 앱 설치</p><p class="setting-hint">휴대폰 웹앱에서는 HTTPS 주소가 필요해요. 설치형 버전은 Android·iOS 빌드로 만들 수 있어요.</p><button class="secondary" data-action="install">설치 안내</button>'}</section>
  <section class="card settings-card"><div class="section-heading"><h2>${icon("chat")}대화 알림</h2></div><p>${native.active ? "앱을 열어 두면 새 메시지를 5초마다 확인해요. 설치형 앱의 잠금 화면 알림은 아직 연결되지 않았어요." : "앱을 열어 두면 새 메시지를 5초마다 확인해요. 잠금 화면 알림은 서버의 Web Push 설정 후 켤 수 있어요."}</p>${native.active ? '<p class="setting-hint">잠금 화면 알림을 사용하려면 Android FCM·iOS APNs 설정과 네이티브 푸시 연동이 필요해요.</p>' : '<button class="secondary" data-action="notifications">이 기기에서 알림 켜기</button><p class="setting-hint">아이폰은 iOS 16.4 이상에서 홈 화면에 설치한 뒤 허용해 주세요. 알림에는 대화 내용을 표시하지 않아요.</p>'}</section>
  <section class="card settings-card wide"><div class="section-heading"><h2>${icon("download")}기록 보관과 백업</h2></div><p>글·일정·일기·댓글·메시지와 파일 목록을 JSON으로 내려받아요. 사진·영상 원본은 포함되지 않으므로 ${state.mode === "demo" ? "체험 파일을 원본 열기로 따로 저장해 주세요." : "Google Drive에서도 별도로 백업해 주세요."}</p><div class="button-row"><button class="secondary" data-action="export">${icon("download")}기록 내보내기</button>${state.mode === "demo" ? '<button class="text-button danger" data-action="reset">체험 데이터 초기화</button>' : '<button class="text-button" data-action="refresh">지금 동기화</button>'}</div><p class="setting-hint">원본은 게시글을 삭제해도 유지해요. Drive에서 파일을 직접 삭제하면 게시글에서도 열 수 없어요.</p></section></div>`;
}
function clearDriveImages() {
  driveObserver?.disconnect();
  for (const job of driveLoads.values()) job.controller.abort();
  driveLoads.clear();
  for (const url of driveUrls.values()) URL.revokeObjectURL(url);
  driveUrls.clear();
}
async function driveImageUrl(id) {
  if (driveUrls.has(id)) {
    recordPreviewCacheHit();
    return driveUrls.get(id);
  }
  let job = driveLoads.get(id);
  if (!job) {
    job = { controller: new AbortController() };
    driveLoads.set(id, job);
    const started = performance.now();
    job.promise = google.image(id, job.controller.signal).then((blob) => {
      if (driveLoads.get(id) !== job) throw new DOMException("사진 요청이 취소됐어요.", "AbortError");
      recordPreviewDownload(blob.size, performance.now() - started);
      const url = URL.createObjectURL(blob);
      driveUrls.set(id, url);
      return url;
    }).finally(() => {
      if (driveLoads.get(id) === job) driveLoads.delete(id);
    });
  }
  return job.promise;
}
async function loadDriveImage(img) {
  const fallback = img.parentElement.querySelector(".file-cover");
  const status = img.parentElement.querySelector("[data-preview-status]");
  const tryOriginal = () => {
    if (!img.isConnected || !img.dataset.driveOriginal) return false;
    img.dataset.driveFile = img.dataset.driveOriginal;
    delete img.dataset.driveOriginal;
    loadDriveImage(img);
    return true;
  };
  const accessButton = img.parentElement.querySelector("[data-photo-access]");
  img.onload = () => {
    if (img.isConnected) {
      img.hidden = false;
      fallback.hidden = true;
      if (accessButton) accessButton.hidden = true;
    }
  };
  img.onerror = () => {
    img.hidden = true;
    fallback.hidden = false;
    if (!tryOriginal()) status.textContent = "이 사진은 원본 열기로 확인해 주세요.";
  };
  try {
    const url = await driveImageUrl(img.dataset.driveFile);
    if (img.isConnected && driveUrls.get(img.dataset.driveFile) === url) img.src = url;
  } catch (error) {
    if (img.isConnected && !tryOriginal()) {
      if (error.code === "rate_limit" || error.status === 429) status.textContent = "사진 요청이 많아 잠시 후 다시 시도해 주세요.";
      else if (error.status === 403 || error.status === 404) {
        status.textContent = "사진을 찾지 못했거나 접근이 거부됐어요. 사진 접근을 허용하거나 Drive 공유 권한을 확인해 주세요.";
        if (accessButton) accessButton.hidden = false;
      } else if (error.status === 401 || !google.connected) status.textContent = "설정에서 Google을 다시 연결해 주세요.";
      else if (error.code === "invalid_image") status.textContent = "미리볼 수 없는 사진이에요. 원본 열기를 이용해 주세요.";
      else status.textContent = "사진을 불러오지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.";
    }
  }
}
async function hydrateMedia() {
  for (const img of document.querySelectorAll("img[data-file], video[data-file]")) {
    try {
      if (!urls.has(img.dataset.file)) {
        const file = await local.file(img.dataset.file);
        if (file) urls.set(img.dataset.file, URL.createObjectURL(file.blob));
      }
      if (img.isConnected && urls.has(img.dataset.file)) img.src = urls.get(img.dataset.file);
    } catch {
    }
  }
  driveObserver?.disconnect();
  const images = [...document.querySelectorAll("img[data-drive-file]")];
  const visible = new Set(images.map((img) => img.dataset.driveFile));
  for (const [id, url] of driveUrls) if (driveUrls.size > 32 && !visible.has(id)) {
    URL.revokeObjectURL(url);
    driveUrls.delete(id);
  }
  for (const [id, job] of driveLoads) if (!visible.has(id)) {
    job.controller.abort();
    driveLoads.delete(id);
  }
  for (const img of images) if (!img.src) {
    if (driveObserver) driveObserver.observe(img.parentElement);
    else loadDriveImage(img);
  }
}
function closeDialog() {
  state.activePost = null;
  state.replyTo = "";
  $("#editor").close();
  $("#editor").innerHTML = "";
  hydrateMedia();
}
function dialog(title, content) {
  const el = $("#editor");
  el.innerHTML = `<div class="modal-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close" aria-label="닫기">${icon("close")}</button></div>${content}`;
  if (!el.open) el.showModal();
}
function openEditor(kind, row) {
  if (kind === "event" && state.mode === "live" && !google.connected) {
    toast("설정에서 Google을 먼저 연결해 주세요.");
    state.view = "settings";
    render();
    return;
  }
  if (kind === "comment") state.postScroll = $("#editor").scrollTop || 0;
  const data = row?.data || {};
  const title = { event: "우리의 약속", diary: "오늘의 마음", post: "추억 남기기", comment: "댓글 수정" }[kind];
  let end = data.end?.dateTime ? new Date(data.end.dateTime) : null;
  let endDate = data.end?.date ? /* @__PURE__ */ new Date(`${data.end.date}T12:00:00`) : null;
  if (endDate) endDate.setDate(endDate.getDate() - 1);
  dialog(title, `<form id="record-form" data-kind="${kind}" data-id="${row?.id || ""}" data-version="${escapeHtml(row?.updated_at || row?.created_at || "")}">${kind !== "comment" ? `<label>날짜<input type="date" name="date" value="${escapeHtml(data.date || (state.view === "calendar" ? state.day : today))}" required></label>` : `<input type="hidden" name="postId" value="${escapeHtml(data.postId)}">`}${["event", "post"].includes(kind) ? `<label>제목<input name="title" value="${escapeHtml(data.title || "")}" maxlength="120" placeholder="어떤 순간인가요?" required></label>` : ""}${kind === "event" ? `<div class="form-row"><label>시작 시간 <span class="optional">비우면 하루 종일</span><input name="time" type="time" value="${escapeHtml(data.time || "")}"></label><label>종료 날짜<input name="endDate" type="date" value="${end ? dateKey(end) : endDate ? dateKey(endDate) : data.date || (state.view === "calendar" ? state.day : today)}"></label><label>종료 시간<input name="endTime" type="time" value="${end ? `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}` : ""}"></label></div>` : ""}${kind === "diary" ? `<label>오늘의 마음<select name="mood">${["☀", "☁", "☂", "♡", "✦"].map((m) => `<option ${data.mood === m ? "selected" : ""}>${m}</option>`).join("")}</select></label><p class="form-note">${icon("heart")}이 일기는 두 사람 모두에게 공개돼요.</p>` : ""}<label>${kind === "event" ? "메모" : "이야기"}<textarea name="text" rows="${kind === "event" ? 3 : 6}" maxlength="10000" placeholder="오늘을 기억할 작은 이야기…" ${["diary", "comment"].includes(kind) ? "required" : ""}>${escapeHtml(data.text || "")}</textarea></label>${["post", "diary"].includes(kind) ? `<label class="file-input">${icon("photo")}사진·동영상 원본 추가<input type="file" name="files" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif,video/mp4,video/quicktime,video/webm,video/3gpp" multiple></label><p id="file-summary" class="setting-hint">${data.files?.length ? `기존 파일 ${data.files.length}개는 유지됩니다. ` : ""}${state.mode === "demo" ? "원본은 이 브라우저에 저장돼요. 브라우저 데이터를 지우면 삭제돼요." : "원본을 공유 Drive 폴더에 보관해요. 전송 중 이 화면을 열어 두세요."}</p>` : ""}<p id="form-error" class="form-error" role="alert"></p><div class="modal-actions">${kind === "event" && row ? `<button class="text-button danger" type="button" data-action="delete-event" data-id="${row.id}">일정 삭제</button>` : ""}<button type="button" class="secondary" data-action="close">취소</button><button type="submit" class="primary">${row ? "수정 저장" : "기록하기"}</button></div></form>`);
}
function openPost(row, scroll = 0) {
  if (!row) return;
  state.activePost = row.id;
  dialog(escapeHtml(postTitle(row)), `<article class="post-detail"><div class="byline">${avatar(row.author_id, true)}<span>${escapeHtml(nameOf(row.author_id))} · ${formatDate(row.data.date)}</span></div><p class="record-times">작성 ${escapeHtml(new Date(row.created_at).toLocaleString("ko-KR"))}${row.updated_at && row.updated_at !== row.created_at ? ` · 수정 ${escapeHtml(new Date(row.updated_at).toLocaleString("ko-KR"))}` : ""}</p><p class="post-text">${escapeHtml(row.data.text || "")}</p><div class="attachment-gallery"><div class="attachments" aria-label="첨부 파일" tabindex="0">${(row.data.files || []).map((file, index) => `<div class="attachment" role="group" aria-label="${index + 1} / ${row.data.files.length}">${file.source === "local" ? file.type.startsWith("image/") ? `<img data-file="${file.id}" alt="${escapeHtml(file.name)}">` : `<video controls playsinline preload="metadata" data-file="${file.id}" aria-label="${escapeHtml(file.name)}"></video>` : file.type.startsWith("image/") ? drivePhoto(file, file.name, true) : `<div class="drive-attachment">${icon("cloud")}<strong>${escapeHtml(file.name)}</strong><span>Google Drive · 원본 보관</span></div>`}<button class="secondary" data-action="open-file" data-id="${escapeHtml(file.id)}" data-source="${file.source}">${icon("download")}원본 열기</button></div>`).join("")}</div>${row.data.files?.length > 1 ? `<div class="attachment-navigation"><button type="button" class="icon-button" data-action="attachment-prev" aria-label="이전 사진 또는 동영상" disabled>${icon("left")}</button><span class="attachment-position" aria-live="polite">1 / ${row.data.files.length}</span><button type="button" class="icon-button" data-action="attachment-next" aria-label="다음 사진 또는 동영상">${icon("right")}</button></div>` : ""}</div>${canEdit(row) ? `<div class="post-tools"><button class="text-button" data-action="edit" data-id="${row.id}">게시글 수정</button>${row.author_id === state.user ? `<button class="text-button danger" data-action="delete" data-id="${row.id}">삭제</button>` : ""}</div>` : ""}<div class="divider"></div><h3>둘이 나누는 이야기 <span class="muted">${records("comment").filter((c) => c.data.postId === row.id).length}</span></h3><div class="comments">${commentList(row)}</div><form id="comment-form" data-post="${row.id}" data-reply="${escapeHtml(state.replyTo)}" class="comment-form">${state.replyTo ? '<p>답글 작성 중 <button type="button" class="text-button" data-action="cancel-reply">취소</button></p>' : ""}<label class="sr-only" for="comment-text">댓글</label><textarea id="comment-text" name="text" rows="2" maxlength="10000" required placeholder="이 순간에 마음 한 줄…"></textarea><button type="submit" class="primary">댓글 남기기</button><p class="form-error" role="alert"></p></form></article>`);
  $("#editor").scrollTop = scroll;
  hydrateMedia();
}
function commentList(row) {
  const comments = sortRecords(records("comment").filter((c) => c.data.postId === row.id), "oldest");
  const renderComment = (c, reply = false) => `<div class="comment ${reply ? "reply" : ""}" id="comment-${escapeHtml(c.id)}">${avatar(c.author_id, true)}<div><strong>${escapeHtml(nameOf(c.author_id))}</strong><p>${escapeHtml(c.data.text)}</p><small>${timeOf(c.created_at)}${c.updated_at && c.updated_at !== c.created_at ? " · 수정됨" : ""}</small><button class="text-button" data-action="reply" data-id="${c.id}">답글</button>${c.author_id === state.user ? `<button class="text-button" data-action="edit" data-id="${c.id}">수정</button><button class="text-button danger" data-action="delete-comment" data-id="${c.id}" data-post="${row.id}">삭제</button>` : ""}</div></div>`;
  return comments.filter((c) => !c.data.replyTo || !comments.some((p) => p.id === c.data.replyTo)).map((c) => renderComment(c) + comments.filter((r) => r.data.replyTo === c.id).map((r) => renderComment(r, true)).join("")).join("") || '<p class="muted">첫 댓글로 마음을 전해 보세요.</p>';
}
function openNotices() {
  state.activePost = null;
  dialog("알림", (notices().some((r) => !noticeRead(r.id)) ? '<div class="notification-actions"><button class="text-button" data-action="notice-read-all">모두 읽음</button></div>' : "") + '<div class="notification-list">' + notices().map((r) => {
    const isEvent = r.kind === "event" || r.kind === "event_notice";
    const parent = r.kind === "comment" ? state.records.find((item) => item.id === r.data.postId) : null;
    const title = isEvent ? r.data.title : postTitle(parent || r);
    const action = isEvent ? "새 일정" : r.kind === "comment" ? r.data.replyTo ? "새 답글" : "새 댓글" : "새 기록";
    return `<button class="notification-item ${noticeRead(r.id) ? "" : "unread"}" data-action="notice-open" data-id="${escapeHtml(r.id)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(nameOf(r.author_id))}님의 ${action} · ${escapeHtml(new Date(r.created_at).toLocaleString("ko-KR"))}</span></button>`;
  }).join("") + (notices().length ? "" : '<p class="muted">새 알림이 없어요.</p>') + "</div>");
}
async function syncCalendar(shouldApply = () => true) {
  const sequence = ++calendarSyncSequence;
  const year = state.year, month = state.month;
  try {
    if (!google.connected) await google.restore();
    const rows = await google.events(year, month);
    if (sequence === calendarSyncSequence && state.mode === "live" && shouldApply()) {
      state.events = rows;
      state.calendarError = "";
    }
  } catch (error) {
    if (sequence === calendarSyncSequence && state.mode === "live" && shouldApply()) {
      state.calendarError = error.message || "Google 캘린더를 동기화하지 못했어요.";
    }
  }
}
async function syncUpcoming(shouldApply = () => true) {
  const sequence = ++upcomingSyncSequence, day = dateKey();
  try {
    if (!google.connected) await google.restore();
    const rows = await google.upcomingEvents(day);
    if (sequence === upcomingSyncSequence && state.mode === "live" && day === dateKey() && shouldApply()) {
      state.upcomingEvents = rows;
      state.upcomingError = "";
      upcomingDate = day;
    }
  } catch (error) {
    if (sequence === upcomingSyncSequence && state.mode === "live" && shouldApply()) {
      state.upcomingError = error.message || "다가오는 일정을 불러오지 못했어요.";
      upcomingDate = day;
    }
  }
}
async function load(refreshGoogle = false) {
  if (state.mode === "demo") {
    state.records = await local.list();
    try {
      state.notificationReads = JSON.parse(localStorage.getItem("geonjukong-demo-notification-reads") || "[]");
      state.couple = JSON.parse(localStorage.getItem("geonjukong-demo-couple") || "{}");
    } catch {
      state.notificationReads = [];
      state.couple = {};
    }
  } else {
    const user = state.user;
    const current = () => state.mode === "live" && state.user === user && auth.user?.id === user;
    await updatePendingNotices(user);
    if (!current()) return;
    const [rows, reads, noticeReads, couple] = await Promise.all([repository.list(), repository.readAt(), repository.notificationReads(), repository.coupleSettings()]);
    if (!current()) return;
    state.records = rows;
    state.reads = reads;
    state.notificationReads = noticeReads.map((r) => ({ ...r, user_id: user }));
    state.couple = couple;
    if (refreshGoogle) await Promise.all([syncCalendar(current), syncUpcoming(current)]);
    if (!current()) return;
  }
  state.error = "";
  state.lastSync = (/* @__PURE__ */ new Date()).toISOString();
}
async function markRead() {
  if (state.mode === "demo") {
    const read = { user_id: state.user, last_read_at: (/* @__PURE__ */ new Date()).toISOString() };
    state.reads = state.reads.filter((r) => r.user_id !== state.user).concat(read);
    localStorage.setItem("geonjukong-demo-reads", JSON.stringify(state.reads));
  } else {
    const result = await repository.markRead(state.user);
    if (result?.[0]) state.reads = state.reads.filter((r) => r.user_id !== state.user).concat(result[0]);
  }
}
async function navigate(view, back = false) {
  if (!views[view]) return;
  if (!back && view !== state.view) viewHistory.push(state.view);
  state.view = view;
  history.replaceState({ view }, "", `#${view}`);
  if (view === "chat") await markRead();
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function requireLive() {
  if (state.mode !== "live") throw new Error("실제 연동은 Google 로그인과 서버 설정 후 사용할 수 있어요. 체험 모드에서는 외부 데이터를 변경하지 않아요.");
}
async function enableNotifications() {
  if (native.active) throw new Error("설치형 앱의 잠금 화면 알림은 별도 APNs·FCM 연동이 필요합니다. 현재 앱을 열어 두면 대화가 갱신돼요.");
  requireLive();
  if (!window.APP_CONFIG.vapidPublicKey) throw new Error("Web Push 서버 설정이 필요해요. README의 알림 설정을 먼저 완료해 주세요.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("이 브라우저는 푸시를 지원하지 않아요. 아이폰은 홈 화면에 설치한 뒤 다시 시도해 주세요.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 허용되지 않았어요. 브라우저 설정에서 변경할 수 있어요.");
  const registration = await navigator.serviceWorker.ready;
  const key = window.APP_CONFIG.vapidPublicKey;
  const binary = atob(key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - key.length % 4) % 4));
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(binary, (c) => c.charCodeAt(0)) });
  await repository.subscribe(state.user, subscription.toJSON());
  toast("이 기기의 새 메시지 알림을 켰어요.");
}
async function seed() {
  if (localStorage.getItem("geonjukong-seeded")) return;
  const shifted = (offset) => {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() + offset);
    return dateKey(d);
  };
  const sample = [
    ["event", "demo-me", { title: "같이 저녁 먹기", date: today, time: "19:00", text: "오늘은 서로 좋아하는 메뉴로." }],
    ["event", "demo-partner", { title: "느긋한 산책", date: shifted(2), time: "16:00", text: "커피 한 잔, 그리고 우리 둘." }],
    ["diary", "demo-me", { date: today, mood: "☀", text: "함께하는 일상을 이렇게 모아 두면 좋겠다고 생각했어. 특별한 일이 없는 날도, 너랑 함께라면 기억하고 싶은 하루가 되니까." }],
    ["diary", "demo-partner", { date: shifted(-1), mood: "♡", text: "바쁜 하루 끝에 나누는 짧은 대화가 참 좋아. 내일은 조금 더 천천히, 서로의 하루를 들어 주자." }],
    ["post", "demo-me", { title: "별일 없이도 좋은 하루", date: shifted(-1), text: "걷다가 나눈 시시한 이야기까지, 오래 기억하고 싶어서.", art: "walk", files: [] }],
    ["post", "demo-partner", { title: "우리의 첫 번째 페이지", date: shifted(-3), text: "여기에 우리만의 순간들을 하나씩 모아 보자.", files: [] }],
    ["message", "demo-partner", { text: "우리만의 공간이 생겼네 ♡ 오늘 하루는 어땠어?" }]
  ];
  for (let i = 0; i < sample.length; i++) {
    const [kind, author_id, data] = sample[i];
    await local.put({ id: crypto.randomUUID(), kind, author_id, data, created_at: new Date(Date.now() - (sample.length - i) * 6e4).toISOString() });
  }
  localStorage.setItem("geonjukong-seeded", "1");
}
async function start(callbackUrl) {
  try {
    await auth.callback(callbackUrl);
    if (configured && auth.user) {
      const members = await repository.members();
      if (members.length !== 2) throw new Error("허용된 두 계정의 서버 설정을 확인해 주세요.");
      state.mode = "live";
      state.user = auth.user.id;
      state.members = members;
      google.setTokenProvider((force) => auth.googleToken(force));
    } else {
      await seed();
      state.user = localStorage.getItem("geonjukong-demo-person") === "demo-partner" ? "demo-partner" : "demo-me";
      try {
        state.reads = JSON.parse(localStorage.getItem("geonjukong-demo-reads") || "[]");
      } catch {
        state.reads = [];
      }
    }
    state.view = views[location.hash.slice(1)] ? location.hash.slice(1) : "home";
    await load(state.mode === "live");
    render();
    if (state.mode === "live" && !Object.keys(state.couple).length) openCoupleSetup();
    if (state.view === "chat") await markRead();
    google.prepare().catch(report);
    if (!native.active && "serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => toast("오프라인 설치 기능을 준비하지 못했어요. HTTPS 주소에서 다시 확인해 주세요."));
  } catch (error) {
    state.mode = "demo";
    state.user = "demo-me";
    state.members = [];
    state.records = [];
    state.events = [];
    $("#app").innerHTML = `<div class="access-error">${icon("heart")}<h1>우리 둘의 공간이에요</h1><p>${escapeHtml(error.message)}</p><button class="primary" data-action="logout">로그아웃하고 다시 시작</button><button class="secondary" data-action="reload">다시 시도</button></div>`;
  }
}
async function handleBack() {
  if (state.busy) {
    toast("저장이 끝날 때까지 기다려 주세요.");
    return;
  }
  if ($("#editor").open) {
    if ($("#record-form")?.dataset.kind === "comment" && state.activePost) openPost(state.records.find((r) => r.id === state.activePost), state.postScroll);
    else closeDialog();
    return;
  }
  if (viewHistory.length) {
    await navigate(viewHistory.pop(), true);
    return;
  }
  if (state.view !== "home") {
    await navigate("home", true);
    return;
  }
  if (confirm("앱을 종료할까요?")) {
    if (native.active) await native.exit();
    else {
      toast("브라우저 메뉴에서 창을 닫을 수 있어요.");
    }
  }
}
async function boot() {
  await native.onBack(handleBack);
  const launchUrl = await native.listen(async (url) => {
    if (!isAuthCallback(url) || processingLink) return;
    processingLink = true;
    try {
      await start(url);
    } finally {
      processingLink = false;
    }
  });
  await start(isAuthCallback(launchUrl) ? launchUrl : void 0);
  if (!native.active && history.pushState) history.pushState({ view: state.view }, "", `#${state.view}`);
}
var $, today, now, state, demoNames, paths, icon, labels, navigation, nameOf, formatDate, timeOf, records, events, sorted, memoriesRows, postTitle, canEdit, notices, noticeRead, pendingNotices, pendingKey, orderControl, avatar, addButton, demoBanner, views, urls, driveUrls, driveLoads, driveObserver, calendarSyncSequence, upcomingSyncSequence, upcomingDate, viewHistory, installPrompt, polling, pendingRender, pendingCommentPost, nextCalendarRefresh, processingLink;
var init_app = __esm({
  "src/app.js"() {
    init_core();
    init_media();
    init_storage();
    init_backend();
    init_google();
    init_platform();
    $ = (selector) => document.querySelector(selector);
    today = dateKey();
    now = /* @__PURE__ */ new Date();
    state = { mode: "demo", user: "demo-me", view: "home", year: now.getFullYear(), month: now.getMonth(), day: today, records: [], events: [], upcomingEvents: [], upcomingError: "", reads: [], members: [], busy: false, filter: "", error: "", noticeError: "", calendarError: "", lastSync: null, order: "date", notificationReads: [], couple: {}, activePost: null, postScroll: 0, replyTo: "" };
    demoNames = { "demo-me": "나", "demo-partner": "짝꿍" };
    paths = {
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
      home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-12 4h.01M12 15h.01M16 15h.01"/>',
      photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
      book: '<path d="M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v16c-4-1-7 0-9 2-2-2-5-3-9-2Z"/>',
      chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2 2-7a8.5 8.5 0 1 1 18-3.5Z"/><path d="M7 11h.01M12 11h.01M17 11h.01"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 3v4l4 1 3 3 3-3 4-1v-4l2-3-2-3-3-1-1-3Z"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
      left: '<path d="m15 6-6 6 6 6"/>',
      right: '<path d="m9 6 6 6-6 6"/>',
      cloud: '<path d="M7 18a5 5 0 1 1 1-10 6 6 0 0 1 12 2 4 4 0 0 1-1 8Z"/>',
      close: '<path d="m6 6 12 12M6 18 18 6"/>',
      send: '<path d="m22 2-7 20-4-9L2 9Zm0 0L11 13"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
      logout: '<path d="M9 3H4v18h5M9 12h13m-5-5 5 5-5 5"/>',
      search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'
    };
    icon = (name, extra = "") => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.heart}</svg>`;
    labels = { home: "우리의 오늘", calendar: "캘린더", memories: "게시판", diary: "우리의 일기", chat: "둘만의 대화", settings: "설정" };
    navigation = { home: "home", chat: "chat", calendar: "calendar", memories: "photo", settings: "settings" };
    labels.home = "홈";
    labels.chat = "채팅";
    labels.memories = "게시판";
    paths.bell = '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>';
    nameOf = (id) => demoNames[id] || state.members.find((m) => m.email === id)?.display_name || (id === state.user ? state.members.find((m) => m.email === auth.user?.email)?.display_name || "나" : "짝꿍");
    formatDate = (key, options = { month: "long", day: "numeric", weekday: "short" }) => (/* @__PURE__ */ new Date(`${key}T12:00:00`)).toLocaleDateString("ko-KR", options);
    timeOf = (iso) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    records = (kind) => state.records.filter((r) => r.kind === kind);
    events = () => [...state.mode === "demo" ? records("event") : state.events, ...coupleEvents(state.year, state.couple)];
    sorted = (rows) => sortRecords(rows, state.order);
    memoriesRows = () => state.records.filter((r) => r.kind === "diary" || r.kind === "post");
    postTitle = (row) => row.data.title || (row.kind === "diary" ? "오늘의 일기" : "제목 없음");
    canEdit = (row) => row.author_id === state.user || row.kind === "post" && row.data.space === "board";
    notices = () => sortRecords(state.records.filter((r) => (["post", "diary", "comment", "event_notice"].includes(r.kind) || state.mode === "demo" && r.kind === "event") && r.author_id !== state.user));
    noticeRead = (id) => state.notificationReads.some((r) => r.record_id === id && r.user_id === state.user);
    pendingNotices = /* @__PURE__ */ new Map();
    pendingKey = (user) => `geonjukong-pending-calendar-notices:${user}`;
    orderControl = () => `<label class="sort-control">정렬 <select id="post-order"><option value="date" ${state.order === "date" ? "selected" : ""}>날짜순</option><option value="newest" ${state.order === "newest" ? "selected" : ""}>최신순</option></select></label>`;
    avatar = (id, small = false) => `<span class="avatar ${id === state.user ? "me" : "partner"} ${small ? "small" : ""}" aria-hidden="true">${escapeHtml(nameOf(id).slice(0, 1))}</span>`;
    addButton = (kind, label, cls = "primary") => `<button class="${cls}" data-action="new" data-kind="${kind}">${icon("plus")}${label}</button>`;
    demoBanner = () => `<div class="demo-banner ${state.mode === "live" ? "live-banner" : ""}">${icon(state.mode === "demo" ? "cloud" : "check")}<span>${state.mode === "demo" ? "체험 기록은 이 브라우저에만 저장돼요. 두 기기에서 함께 쓰려면 계정을 연결해 주세요." : `두 사람에게만 공개되는 공간이에요.${state.lastSync ? ` · ${timeOf(state.lastSync)} 동기화` : ""}`}</span><button data-view="settings">${state.mode === "demo" ? "연결 설정" : "관리"} ${icon("right")}</button></div>`;
    views = { home, calendar, memories, chat, settings };
    urls = /* @__PURE__ */ new Map();
    driveUrls = /* @__PURE__ */ new Map();
    driveLoads = /* @__PURE__ */ new Map();
    driveObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        driveObserver.unobserve(entry.target);
        loadDriveImage(entry.target.querySelector("img"));
      }
    }, { rootMargin: "200px" }) : null;
    calendarSyncSequence = 0;
    upcomingSyncSequence = 0;
    upcomingDate = "";
    viewHistory = [];
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
    });
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("button, a[data-action], a[data-view]");
      if (!button) return;
      try {
        if (button.dataset.view) {
          if (button.tagName === "A") event.preventDefault();
          await navigate(button.dataset.view);
          return;
        }
        const action = button.dataset.action;
        const row = state.records.find((r) => r.id === button.dataset.id);
        if (action === "new") openEditor(button.dataset.kind);
        if (action === "close" && $("#record-form")?.dataset.kind === "comment" && state.activePost) {
          openPost(state.records.find((r) => r.id === state.activePost), state.postScroll);
          return;
        }
        if (action === "close") {
          if (state.busy) throw new Error("저장이 끝날 때까지 기다려 주세요.");
          closeDialog();
        }
        if (action === "reload") location.reload();
        if (action === "edit") {
          if (!row || !canEdit(row)) throw new Error("작성자만 수정할 수 있어요.");
          openEditor(row.kind, row);
        }
        if (action === "day") {
          const repeat = state.day === button.dataset.date;
          state.day = button.dataset.date;
          render();
          if (repeat) {
            const list = events().filter((r) => eventOnDate(r, state.day) && !r.data.automatic);
            if (list.length === 1) openEditor("event", list[0]);
            else if (list.length > 1) dialog("수정할 일정 선택", eventRows(list));
            else openEditor("event");
          }
        }
        if (action === "month" || action === "today") {
          const target = action === "today" ? /* @__PURE__ */ new Date() : new Date(state.year, state.month + Number(button.dataset.offset), 1);
          state.year = target.getFullYear();
          state.month = target.getMonth();
          state.day = action === "today" ? today : dateKey(target);
          if (state.mode === "live") {
            render();
            await syncCalendar();
          }
          render();
        }
        if (action === "edit-event") {
          const record = events().find((r) => r.id === button.dataset.id);
          if (record && !record.data.automatic) openEditor("event", record);
        }
        if (action === "delete-event") {
          const record = events().find((r) => r.id === button.dataset.id);
          if (!record) return;
          if (!confirm("이 약속을 삭제할까요? Google 연동 중이면 공유 캘린더에서도 삭제돼요.")) return;
          if (state.mode === "demo") await repository.remove("demo", state.user, record);
          else await google.deleteEvent(record.id);
          closeDialog();
          await load(true);
          render();
          toast("약속을 삭제했어요.");
        }
        if (action === "notice-list") openNotices();
        if (action === "notice-read-all") {
          const user = state.user, mode = state.mode, ids = notices().filter((r) => !noticeRead(r.id)).map((r) => r.id);
          if (!ids.length) return;
          button.disabled = true;
          try {
            if (mode === "live") await repository.markNotificationsRead(user, ids);
            if (state.user !== user || state.mode !== mode) return;
            const reads = [...state.notificationReads, ...ids.filter((id) => !noticeRead(id)).map((record_id) => ({ user_id: user, record_id }))];
            if (mode === "demo") localStorage.setItem("geonjukong-demo-notification-reads", JSON.stringify(reads));
            state.notificationReads = reads;
            render();
            openNotices();
          } finally {
            button.disabled = false;
          }
        }
        if (action === "notice-open" && row) {
          const target = row.kind === "comment" ? state.records.find((r) => r.id === row.data.postId) : row;
          if (!target) throw new Error("해당 게시물을 찾을 수 없어요.");
          const isEvent = row.kind === "event" || row.kind === "event_notice";
          if (isEvent && !/^\d{4}-\d{2}-\d{2}$/.test(row.data.date || "")) throw new Error("일정 날짜를 확인할 수 없어요.");
          if (state.mode === "live") await repository.markNotificationRead(state.user, row.id);
          state.notificationReads.push({ user_id: state.user, record_id: row.id });
          if (state.mode === "demo") localStorage.setItem("geonjukong-demo-notification-reads", JSON.stringify(state.notificationReads));
          if (isEvent) {
            let date = row.data.date;
            if (state.mode === "live" && row.data.eventId) {
              try {
                date = (await google.event(row.data.eventId))?.data.date || date;
              } catch {
                toast("현재 일정을 확인하지 못해 처음 등록된 날짜로 이동해요.");
              }
            }
            closeDialog();
            state.day = date;
            state.year = Number(date.slice(0, 4));
            state.month = Number(date.slice(5, 7)) - 1;
            await navigate("calendar");
            if (state.mode === "live") {
              await syncCalendar();
              render();
            }
          } else {
            render();
            state.replyTo = "";
            openPost(target);
            if (row.kind === "comment") document.getElementById?.(`comment-${row.id}`)?.scrollIntoView?.({ block: "nearest" });
          }
        }
        if (action === "reply" && row) {
          state.replyTo = row.data.replyTo || row.id;
          openPost(state.records.find((r) => r.id === row.data.postId), $("#editor").scrollTop);
          $("#comment-text")?.focus({ preventScroll: true });
        }
        if (action === "cancel-reply") {
          state.replyTo = "";
          openPost(state.records.find((r) => r.id === state.activePost), $("#editor").scrollTop);
        }
        if (action === "attachment-prev" || action === "attachment-next") {
          const gallery = button.closest(".attachment-gallery, .memory-gallery");
          const track = gallery.querySelector(".attachments, .memory-slides");
          const index = Math.round(track.scrollLeft / track.clientWidth);
          track.scrollTo({ left: (index + (action === "attachment-next" ? 1 : -1)) * track.clientWidth, behavior: "smooth" });
        }
        if (action === "open-post") {
          if (row) {
            state.replyTo = "";
            openPost(row);
          }
        }
        if (action === "delete" || action === "delete-comment") {
          if (!row || !confirm(row.kind === "post" ? "게시글과 댓글을 삭제할까요? 사진·영상 원본은 유지돼요." : "이 기록을 삭제할까요?")) return;
          const scroll = $("#editor").scrollTop || 0;
          await repository.remove(state.mode, state.user, row);
          await load();
          if (action !== "delete-comment") closeDialog();
          render();
          if (action === "delete-comment") {
            const post = state.records.find((r) => r.id === button.dataset.post);
            if (post) openPost(post, scroll);
          }
          toast("기록을 삭제했어요.");
        }
        if (action === "open-file") {
          if (button.dataset.source === "drive") await google.openFile(button.dataset.id);
          else {
            const stored = await local.file(button.dataset.id);
            if (!stored) throw new Error("이 기기에서 원본을 찾을 수 없어요.");
            if (native.active) {
              await native.saveFile(stored.blob, stored.blob.name || "original");
              return;
            }
            const link = document.createElement("a");
            link.href = URL.createObjectURL(stored.blob);
            link.download = stored.blob.name || "original";
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1e4);
          }
        }
        if (action === "photo-access") {
          requireLive();
          const postId = state.activePost, user = state.user;
          const post = state.records.find((record) => record.id === postId);
          if (!post?.data.files?.some((file) => file.source === "drive" && file.id === button.dataset.id && file.type.startsWith("image/"))) throw new Error("해당 사진을 찾을 수 없어요.");
          const editor = $("#editor"), scroll = editor.scrollTop || 0;
          button.disabled = true;
          editor.close();
          try {
            await google.pickPhoto(button.dataset.id);
            if (state.mode !== "live" || state.user !== user || state.activePost !== postId) return;
            openPost(state.records.find((record) => record.id === postId), scroll);
            toast("사진을 다시 불러오고 있어요.");
          } finally {
            if (state.mode === "live" && state.user === user && state.activePost === postId && !editor.open) editor.showModal();
            button.disabled = false;
          }
        }
        if (action === "login") {
          button.disabled = true;
          try {
            await auth.login();
          } finally {
            button.disabled = false;
          }
        }
        if (action === "logout") {
          let pushCleanupFailed = false;
          if (state.mode === "live" && "serviceWorker" in navigator) {
            try {
              const registration = await navigator.serviceWorker.getRegistration();
              const subscription = await registration?.pushManager?.getSubscription();
              if (subscription) {
                try {
                  await repository.unsubscribe(subscription.endpoint);
                } catch {
                  pushCleanupFailed = true;
                }
                try {
                  if (!await subscription.unsubscribe()) pushCleanupFailed = true;
                } catch {
                  pushCleanupFailed = true;
                }
              }
            } catch {
              pushCleanupFailed = true;
            }
          }
          calendarSyncSequence++;
          upcomingSyncSequence++;
          const remoteLogout = auth.logout();
          google.disconnect();
          clearDriveImages();
          state.records = [];
          state.events = [];
          state.upcomingEvents = [];
          state.upcomingError = "";
          upcomingDate = "";
          state.calendarError = "";
          state.noticeError = "";
          state.members = [];
          state.reads = [];
          state.mode = "demo";
          state.user = "demo-me";
          await seed();
          await load();
          render();
          const result = await remoteLogout;
          if (pushCleanupFailed || result?.remote === false) toast("이 기기에서는 로그아웃했지만 서버 로그아웃 또는 알림 해제를 완료하지 못했어요. 연결을 확인해 주세요.");
        }
        if (action === "google-connect") {
          requireLive();
          await auth.login();
        }
        if (action === "sync-birthday") {
          requireLive();
          button.disabled = true;
          try {
            const user = state.user, birthday = await google.birthday();
            if (state.mode !== "live" || state.user !== user) return;
            state.couple = await repository.updateCoupleDate("birthday", birthday);
            render();
            toast("내 Google 생일을 가져왔어요.");
          } finally {
            button.disabled = false;
          }
        }
        if (action === "pick-folder") {
          requireLive();
          const folder = await google.pickFolder();
          if (folder.id !== window.APP_CONFIG.driveFolderId) throw new Error(`선택한 폴더 ID: ${folder.id}. 공용 폴더가 맞다면 config.js의 driveFolderId를 이 값으로 설정해 주세요.`);
          await google.checkFolder();
          toast("공유 Drive 폴더 접근을 확인했어요.");
        }
        if (action === "calendar-retry") {
          button.disabled = true;
          try {
            await Promise.all([syncCalendar(), syncUpcoming()]);
            render();
            if (!state.calendarError && !state.upcomingError) toast("캘린더를 동기화했어요.");
          } finally {
            button.disabled = false;
          }
        }
        if (action === "refresh") {
          button.disabled = true;
          try {
            await load(true);
            render();
            toast(state.calendarError || state.upcomingError ? "공유 기록을 불러왔지만 캘린더 동기화에 실패했어요." : "최신 기록을 불러왔어요.");
          } finally {
            button.disabled = false;
          }
        }
        if (action === "export") {
          const payload = { app: "GeonJuKong", version: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), mode: state.mode, records: state.records, calendar: events(), notice: "파일 목록만 포함됩니다. 원본 파일은 별도로 백업해 주세요." };
          if (native.active) {
            await native.saveFile(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `GeonJuKong-${today}.json`);
            return;
          }
          const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = `GeonJuKong-기록-${today}.json`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1e4);
        }
        if (action === "reset") {
          if (!confirm("이 브라우저의 체험 기록과 원본 파일을 모두 지우고 예시 기록으로 초기화할까요? 실제 공유 데이터에는 영향이 없어요.")) return;
          await local.clear();
          localStorage.removeItem("geonjukong-seeded");
          localStorage.removeItem("geonjukong-demo-reads");
          for (const url of urls.values()) URL.revokeObjectURL(url);
          urls.clear();
          state.reads = [];
          await seed();
          await load();
          render();
          toast("체험 데이터를 초기화했어요.");
        }
        if (action === "install") {
          if (native.active) {
            toast("설치형 GeonJuKong 앱을 사용하고 있어요.");
            return;
          }
          if (installPrompt) {
            await installPrompt.prompt();
            installPrompt = null;
          } else toast("아이폰: Safari 공유 → 홈 화면에 추가 / 갤럭시: Chrome 메뉴 → 앱 설치");
        }
        if (action === "notifications") await enableNotifications();
      } catch (error) {
        report(error);
      }
    });
    document.addEventListener("scroll", (event) => {
      const track = event.target;
      if (!(track.classList?.contains("attachments") || track.classList?.contains("memory-slides")) || !track.clientWidth) return;
      const gallery = track.closest(".attachment-gallery, .memory-gallery");
      const count = track.children.length;
      const index = Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / track.clientWidth)));
      const position = gallery.querySelector(".attachment-position");
      if (!position) return;
      position.textContent = `${index + 1} / ${count}`;
      gallery.querySelector('[data-action="attachment-prev"]').disabled = index === 0;
      gallery.querySelector('[data-action="attachment-next"]').disabled = index === count - 1;
    }, true);
    $("#editor").addEventListener("cancel", (event) => {
      if (state.busy) event.preventDefault();
    });
    document.addEventListener("change", (event) => {
      if (event.target.id === "post-order") {
        state.order = event.target.value;
        render();
      }
      if (event.target.id === "demo-person" && state.mode === "demo") {
        state.user = event.target.value;
        localStorage.setItem("geonjukong-demo-person", state.user);
        render();
      }
      if (event.target.name === "files") $("#file-summary").textContent = `${event.target.files.length}개 선택 · ${[...event.target.files].reduce((n, f2) => n + f2.size, 0) / 1024 / 1024 < 1 ? "1MB 미만" : `${Math.round([...event.target.files].reduce((n, f2) => n + f2.size, 0) / 1024 / 1024)}MB`} · 원본으로 저장해요.`;
    });
    document.addEventListener("submit", async (event) => {
      const form = event.target;
      if (!["record-form", "chat-form", "comment-form", "search-form", "couple-form", "couple-setup-form"].includes(form.id)) return;
      event.preventDefault();
      if (state.busy) return;
      if (form.id === "search-form") {
        state.filter = new FormData(form).get("search").trim();
        render();
        return;
      }
      const submit = form.querySelector('[type="submit"]');
      const original = submit.textContent;
      state.busy = true;
      submit.disabled = true;
      const errorBox = form.querySelector(".form-error");
      if (errorBox) errorBox.textContent = "";
      try {
        if (form.id === "couple-form" || form.id === "couple-setup-form") {
          const values = Object.fromEntries(new FormData(form));
          const startDate = coupleDateValue(values, "startDate", "연애 시작일");
          if (form.id === "couple-setup-form") {
            const data = { startDate, birthdays: [] };
            const created = await repository.createCoupleSettings(data);
            if (!created.length) {
              state.couple = await repository.coupleSettings();
              render();
              throw new Error("이미 공유 설정이 있어요. 설정 화면에서 확인해 주세요.");
            }
            state.couple = data;
            closeDialog();
          } else if (state.mode === "demo") {
            state.couple = { ...state.couple, startDate };
            localStorage.setItem("geonjukong-demo-couple", JSON.stringify(state.couple));
          } else {
            const created = await repository.createCoupleSettings({ startDate, birthdays: [] });
            state.couple = created.length ? created[0].data : await repository.updateCoupleDate("startDate", startDate);
          }
          render();
          toast(form.id === "couple-setup-form" ? "시작일을 저장했어요. 설정에서 각자 Google 생일을 가져와 주세요." : "연애 시작일을 저장했어요.");
        }
        if (form.id === "record-form") {
          const kind = form.dataset.kind;
          const data = Object.fromEntries(new FormData(form));
          delete data.files;
          validateRecord(kind, data);
          let noticeQueueError = "";
          const old = state.records.find((r) => r.id === form.dataset.id);
          if (old) Object.assign(data, { ...old.data, ...data });
          if (["post", "diary"].includes(kind)) {
            data.files = [...old?.data.files || []];
            const files = [...form.elements.files.files];
            files.forEach(safeFileType);
            form.uploadedFiles ||= /* @__PURE__ */ new Map();
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const key = `${file.name}:${file.size}:${file.lastModified}`;
              let metadata = form.uploadedFiles.get(key);
              if (!metadata) {
                if (state.mode === "demo") {
                  const id = crypto.randomUUID();
                  await local.putFile(id, file);
                  metadata = { id, name: file.name, type: file.type, size: file.size, source: "local" };
                } else metadata = await google.upload(file, (p) => {
                  submit.textContent = `${i + 1}/${files.length} · ${p}%`;
                });
                const thumbnail = await createThumbnail(file);
                if (thumbnail) {
                  if (state.mode === "demo") {
                    const id = crypto.randomUUID();
                    await local.putFile(id, thumbnail);
                    metadata.thumbnail = { id, name: thumbnail.name, type: thumbnail.type, size: thumbnail.size, source: "local" };
                  } else {
                    try {
                      metadata.thumbnail = await google.upload(thumbnail, () => {
                      });
                    } catch {
                      toast("썸네일 업로드에 실패하여 원본 미리보기를 사용해요.");
                    }
                  }
                }
                form.uploadedFiles.set(key, metadata);
              }
              data.files.push(metadata);
            }
          }
          let saved;
          if (kind === "event" && state.mode === "live") {
            const event2 = await google.saveEvent(data, form.dataset.id || void 0);
            if (!form.dataset.id) {
              try {
                if (!event2?.id) throw new Error("Missing event ID");
                queueCalendarNotice(state.user, event2, data);
              } catch {
                noticeQueueError = "일정은 저장됐지만 알림을 준비하지 못했어요. 저장 공간을 확인해 주세요.";
              }
            }
          } else saved = await repository.save(state.mode, state.user, kind, data, form.dataset.id || void 0, form.dataset.version || void 0);
          if (saved) state.records = state.records.filter((r) => r.id !== saved.id).concat(saved);
          if (kind !== "comment") closeDialog();
          let refreshFailed = false;
          try {
            await load(kind === "event");
          } catch {
            refreshFailed = true;
            state.error = "기록은 저장됐지만 최신 기록을 불러오지 못했어요. 다시 동기화해 주세요.";
          }
          if (!refreshFailed && kind === "event" && state.mode === "live" && (state.calendarError || state.upcomingError)) {
            refreshFailed = true;
            state.error = "일정은 저장됐지만 캘린더를 갱신하지 못했어요. 다시 동기화해 주세요.";
          }
          if (noticeQueueError) state.noticeError = noticeQueueError;
          render();
          if (kind === "comment") openPost(state.records.find((r) => r.id === data.postId), state.postScroll);
          toast(refreshFailed ? "기록은 저장됐어요. 최신 기록은 다시 동기화해 주세요." : "우리의 기록을 저장했어요.");
        }
        if (form.id === "chat-form") {
          const input = form.elements.message;
          const text = input.value.trim();
          if (!text) throw new Error("메시지를 적어 주세요.");
          const saved = await repository.save(state.mode, state.user, "message", { text });
          input.value = "";
          state.records = state.records.filter((r) => r.id !== saved.id).concat(saved);
          if (state.mode === "live") repository.notify(saved.id).catch(() => toast("메시지는 전송했지만 푸시 알림은 보내지 못했어요."));
          let refreshFailed = false;
          try {
            await markRead();
          } catch {
            refreshFailed = true;
          }
          try {
            await load();
          } catch {
            refreshFailed = true;
          }
          if (refreshFailed) state.error = "메시지는 전송됐지만 읽음 상태나 최신 기록을 갱신하지 못했어요. 다시 동기화해 주세요.";
          render();
          if (refreshFailed) toast("메시지는 전송됐어요. 최신 기록은 다시 동기화해 주세요.");
        }
        if (form.id === "comment-form") {
          const scroll = $("#editor").scrollTop || 0;
          const saved = await repository.save(state.mode, state.user, "comment", { text: form.elements.text.value.trim(), postId: form.dataset.post, ...form.dataset.reply ? { replyTo: form.dataset.reply } : {} });
          form.elements.text.value = "";
          state.replyTo = "";
          state.records = state.records.filter((r) => r.id !== saved.id).concat(saved);
          try {
            await load();
          } catch {
            state.error = "댓글은 저장됐지만 최신 기록을 불러오지 못했어요. 다시 동기화해 주세요.";
          }
          render();
          openPost(state.records.find((r) => r.id === form.dataset.post), scroll);
          toast("댓글을 남겼어요.");
        }
      } catch (error) {
        if (errorBox) errorBox.textContent = error.message;
        else report(error);
      } finally {
        state.busy = false;
        if (submit.isConnected) {
          submit.disabled = false;
          submit.textContent = original;
        }
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.target.matches("#chat-form textarea") && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        event.target.form.requestSubmit();
      }
    });
    polling = false;
    pendingRender = false;
    pendingCommentPost = "";
    nextCalendarRefresh = Date.now() + 6e4;
    setInterval(async () => {
      if (!document.hidden && dateKey() !== today && !$("#editor").open && !document.activeElement.matches("input,textarea,select")) render();
      if (state.mode !== "live" || document.hidden || state.busy || polling) return;
      polling = true;
      const user = state.user, sessionUser = auth.user;
      const current = () => state.mode === "live" && state.user === user && auth.user === sessionUser && !state.busy;
      try {
        const before = JSON.stringify([state.records, state.reads, state.notificationReads, state.couple, state.events, state.upcomingEvents, state.upcomingError, state.calendarError, state.error, state.noticeError]);
        const postId = state.activePost;
        const oldComments = JSON.stringify(records("comment").filter((c) => c.data.postId === postId));
        await updatePendingNotices(user);
        if (!current()) return;
        let [rows, reads, noticeReads, couple] = await Promise.all([repository.list(), repository.readAt(), repository.notificationReads(), repository.coupleSettings()]);
        if (!current()) return;
        if (state.view === "chat") {
          const result = await repository.markRead(user);
          if (!current()) return;
          if (result?.[0]) reads = reads.filter((r) => r.user_id !== user).concat(result[0]);
        }
        state.records = rows;
        state.reads = reads;
        state.notificationReads = noticeReads.map((r) => ({ ...r, user_id: user }));
        state.couple = couple;
        state.error = "";
        state.lastSync = (/* @__PURE__ */ new Date()).toISOString();
        if (before !== JSON.stringify([state.records, state.reads, state.notificationReads, state.couple, state.events, state.upcomingEvents, state.upcomingError, state.calendarError, state.error, state.noticeError])) pendingRender = true;
        if (state.activePost === postId && oldComments !== JSON.stringify(records("comment").filter((c) => c.data.postId === postId))) pendingCommentPost = postId;
        if (state.mode === "live" && (Date.now() >= nextCalendarRefresh || upcomingDate !== dateKey())) {
          nextCalendarRefresh = Date.now() + 6e4;
          await Promise.all([syncCalendar(current), syncUpcoming(current)]);
        }
        if (!current()) {
          nextCalendarRefresh = 0;
          return;
        }
        if (before !== JSON.stringify([state.records, state.reads, state.notificationReads, state.couple, state.events, state.upcomingEvents, state.upcomingError, state.calendarError, state.error, state.noticeError])) pendingRender = true;
        const editor = $("#editor");
        if (editor.open && state.activePost && state.activePost === postId && $("#comment-form")) {
          if (oldComments !== JSON.stringify(records("comment").filter((c) => c.data.postId === postId))) pendingCommentPost = postId;
          const comments = editor.querySelector(".comments");
          const row = state.records.find((r) => r.id === postId);
          if (pendingCommentPost === postId && row && comments && !comments.contains(document.activeElement)) {
            const scroll = editor.scrollTop;
            comments.innerHTML = commentList(row);
            const count = comments.previousElementSibling?.querySelector("span");
            if (count) count.textContent = String(records("comment").filter((c) => c.data.postId === postId).length);
            editor.scrollTop = scroll;
            pendingCommentPost = "";
          }
          if (!row) {
            const error = $("#comment-form").querySelector(".form-error");
            if (error) error.textContent = "상대방이 이 게시물을 삭제했어요. 작성 중인 내용은 복사할 수 있어요.";
          }
        } else pendingCommentPost = "";
        if (pendingRender && !editor.open && !state.busy) {
          const focused = document.activeElement;
          if (state.view === "chat" && focused.matches("#chat-form textarea")) {
            const draft = focused.value, start2 = focused.selectionStart, end = focused.selectionEnd;
            render();
            const input = $("#chat-form textarea");
            input.value = draft;
            input.focus({ preventScroll: true });
            input.setSelectionRange(start2, end);
            pendingRender = false;
          } else if (!focused.matches("input,textarea,select")) {
            render();
            pendingRender = false;
          }
        }
      } catch (error) {
        if (current()) {
          state.error = "공유 기록을 갱신하지 못했어요. 네트워크와 로그인을 확인해 주세요.";
          pendingRender = true;
          if (!$("#editor").open && !document.activeElement.matches("input,textarea,select")) {
            render();
            pendingRender = false;
          }
        }
      } finally {
        polling = false;
      }
    }, 5e3);
    window.addEventListener("popstate", () => {
      if (!native.active && history.pushState) history.pushState({ view: state.view }, "", `#${state.view}`);
      handleBack().catch(report);
    });
    window.addEventListener("hashchange", () => {
      const view = location.hash.slice(1);
      if (views[view] && view !== state.view) navigate(view, true).catch(report);
    });
    processingLink = false;
    boot().catch(report);
  }
});

// src/native-entry.js
init_dist();

// node_modules/@capacitor/app/dist/esm/index.js
init_dist();
var App = registerPlugin("App", {
  web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.AppWeb())
});

// node_modules/@capacitor/browser/dist/esm/index.js
init_dist();
var Browser2 = registerPlugin("Browser", {
  web: () => Promise.resolve().then(() => (init_web2(), web_exports2)).then((m) => new m.BrowserWeb())
});

// node_modules/@capacitor/filesystem/dist/esm/index.js
init_dist();

// node_modules/@capacitor/synapse/dist/synapse.mjs
function s(t) {
  t.CapacitorUtils.Synapse = new Proxy(
    {},
    {
      get(e, n) {
        return new Proxy({}, {
          get(w, o) {
            return (c, p, r) => {
              const i = t.Capacitor.Plugins[n];
              if (i === void 0) {
                r(new Error(`Capacitor plugin ${n} not found`));
                return;
              }
              if (typeof i[o] != "function") {
                r(new Error(`Method ${o} not found in Capacitor plugin ${n}`));
                return;
              }
              (async () => {
                try {
                  const a = await i[o](c);
                  p(a);
                } catch (a) {
                  r(a);
                }
              })();
            };
          }
        });
      }
    }
  );
}
function u(t) {
  t.CapacitorUtils.Synapse = new Proxy(
    {},
    {
      get(e, n) {
        return t.cordova.plugins[n];
      }
    }
  );
}
function f(t = false) {
  typeof window > "u" || (window.CapacitorUtils = window.CapacitorUtils || {}, window.Capacitor !== void 0 && !t ? s(window) : window.cordova !== void 0 && u(window));
}

// node_modules/@capacitor/filesystem/dist/esm/index.js
init_definitions();
var Filesystem = registerPlugin("Filesystem", {
  web: () => Promise.resolve().then(() => (init_web3(), web_exports3)).then((m) => new m.FilesystemWeb())
});
f();

// node_modules/@capacitor/share/dist/esm/index.js
init_dist();
var Share = registerPlugin("Share", {
  web: () => Promise.resolve().then(() => (init_web4(), web_exports4)).then((m) => new m.ShareWeb())
});

// src/native-entry.js
window.GEONJUKONG_NATIVE = {
  active: Capacitor.isNativePlatform(),
  onBack: (handler) => Capacitor.getPlatform() === "android" ? App.addListener("backButton", handler) : void 0,
  exit: () => App.exitApp(),
  open: (url) => Browser2.open({ url }),
  closeBrowser: () => Browser2.close(),
  async saveFile(blob, name) {
    const base64 = await new Promise((resolve2, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve2(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
      reader.readAsDataURL(blob);
    });
    const filename = name.replace(/[\\/\u0000-\u001f]/g, "_").slice(-160) || "original";
    const path = `exports/${Date.now()}-${filename}`;
    const saved = await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache, recursive: true });
    await Share.share({ title: filename, url: saved.uri, dialogTitle: "원본 파일 저장 또는 공유" });
  },
  async listen(handler) {
    await App.addListener("appUrlOpen", ({ url }) => handler(url));
    const launch = await App.getLaunchUrl();
    return launch?.url;
  }
};
await Promise.resolve().then(() => (init_app(), app_exports));
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
