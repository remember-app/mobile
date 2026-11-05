const fs = require('node:fs');
const path = require('node:path');

const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const SCENE_DELEGATE = `import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appWindow = (UIApplication.shared.delegate as? AppDelegate)?.window
    else { return }

    appWindow.windowScene = windowScene
    window = appWindow
    appWindow.makeKeyAndVisible()
  }
}
`;

function withSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config;
  });

  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const file = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName,
        'SceneDelegate.swift',
      );
      fs.writeFileSync(file, SCENE_DELEGATE);
      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const root = config.modRequest.platformProjectRoot;
    const name = config.modRequest.projectName;
    const file = path.join(root, name, 'SceneDelegate.swift');

    if (!project.hasFile(`${name}/SceneDelegate.swift`)) {
      project.addSourceFile(
        file,
        { target: project.getFirstTarget().uuid },
        project.findPBXGroupKey({ name }),
      );
    }
    return config;
  });

  return config;
}

module.exports = withSceneLifecycle;
