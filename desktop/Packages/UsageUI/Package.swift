// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "UsageUI",
  platforms: [.macOS(.v14)],
  products: [.library(name: "UsageUI", targets: ["UsageUI"])],
  dependencies: [.package(path: "../UsageCore")],
  targets: [
    .target(name: "UsageUI", dependencies: ["UsageCore"]),
    .testTarget(name: "UsageUITests", dependencies: ["UsageUI"]),
  ]
)
