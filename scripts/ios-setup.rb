# Configures a freshly generated Capacitor iOS project (ios/<game>) for the App Store:
# Game Center plugin and entitlement, privacy manifest, iPhone-only portrait, icon and splash.
# Shared native code lives once in native/ios and is referenced, not copied.
#   ruby scripts/ios-setup.rb <game>        (needs the xcodeproj gem, which CocoaPods ships)
require 'fileutils'
require 'json'
require 'xcodeproj'

game = ARGV.fetch(0) { abort 'usage: ios-setup.rb <game>' }
root = File.expand_path('..', __dir__)
app_dir = File.join(root, 'ios', game, 'App')
abort "#{app_dir} missing; run `GAME=#{game} npx cap add ios` first" unless Dir.exist?(app_dir)
shared = '../../../native/ios' # relative to ios/<game>/App, where the .xcodeproj lives
# The App Store version for all four apps. Raise the build number (CURRENT_PROJECT_VERSION) in Xcode
# before each upload; raise this for each new release.
VERSION = '1.0.0'

# --- Xcode project ---
project = Xcodeproj::Project.open(File.join(app_dir, 'App.xcodeproj'))
target = project.targets.find { |t| t.name == 'App' }
group = project.main_group.find_subpath('Shared', true)
group.set_source_tree('SOURCE_ROOT')

ref = lambda do |name|
  path = "#{shared}/#{name}"
  group.files.find { |f| f.path == path } || group.new_reference(path, :project)
end
%w[GameCenterPlugin.swift MainViewController.swift].each do |f|
  r = ref.call(f)
  target.source_build_phase.add_file_reference(r, true)
end
target.resources_build_phase.add_file_reference(ref.call('PrivacyInfo.xcprivacy'), true)
ref.call('App.entitlements')
target.add_system_framework('GameKit') unless target.frameworks_build_phase.files.any? { |f| f.display_name == 'GameKit.framework' }
target.build_configurations.each do |c|
  c.build_settings['CODE_SIGN_ENTITLEMENTS'] = "#{shared}/App.entitlements"
  c.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
  c.build_settings['MARKETING_VERSION'] = VERSION
end
project.save

# --- Info.plist ---
plist_path = File.join(app_dir, 'App', 'Info.plist')
plist = Xcodeproj::Plist.read_from_path(plist_path)
plist['UISupportedInterfaceOrientations'] = ['UIInterfaceOrientationPortrait']
plist.delete('UISupportedInterfaceOrientations~ipad')
plist['UIRequiredDeviceCapabilities'] = ['arm64']
plist['ITSAppUsesNonExemptEncryption'] = false
plist['UIStatusBarStyle'] = 'UIStatusBarStyleDarkContent'
# `cap add` sets the display name once and `cap sync` never updates it, so apply appName here.
cap_json = File.join(app_dir, 'App', 'capacitor.config.json')
plist['CFBundleDisplayName'] = JSON.parse(File.read(cap_json))['appName'] if File.exist?(cap_json)
Xcodeproj::Plist.write_to_path(plist, plist_path)

# --- Use MainViewController (registers the Game Center plugin) as the root ---
scene = File.join(app_dir, 'App', 'SceneDelegate.swift')
src = File.read(scene)
File.write(scene, src.sub('rootViewController = CAPBridgeViewController()', 'rootViewController = MainViewController()'))
abort 'SceneDelegate.swift: could not install MainViewController' unless File.read(scene).include?('MainViewController()')

# --- Icon and splash ---
res = File.join(root, 'resources', game)
assets = File.join(app_dir, 'App', 'Assets.xcassets')
FileUtils.cp(File.join(res, 'icon-1024.png'), File.join(assets, 'AppIcon.appiconset', 'AppIcon-512@2x.png'))
Dir[File.join(assets, 'Splash.imageset', '*.png')].each { |f| FileUtils.cp(File.join(res, 'splash-2732.png'), f) }

puts "Configured ios/#{game}"
