// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "UsageCore",
  platforms: [.macOS(.v14)],
  products: [.library(name: "UsageCore", targets: ["UsageCore"])],
  targets: [
    .target(name: "UsageCore"),
    .testTarget(name: "UsageCoreTests", dependencies: ["UsageCore"]),
  ]
)
