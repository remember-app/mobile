// What the runtime version (`app.json` → `runtimeVersion: fingerprint`) is a hash of: everything
// native the bundle depends on, and nothing that changes without the native side changing.
//
// The build number is out because EAS raises it on every TestFlight build (`autoIncrement`) — left
// in, every build would be a runtime of its own, and an update published for the newest one would
// never reach a phone still on the build before it, though both run the same native code.
// The package.json scripts are out because none of them touches the native side, and a new script
// must not cost a build.
/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips: ['ExpoConfigVersions', 'PackageJsonScriptsAll'],
};
