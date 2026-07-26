import Testing
import Foundation
@testable import UsageCore

@Suite("SnappyDecoder")
struct SnappyDecoderTests {
  private func decode(_ bytes: [UInt8], from offset: Int = 0) throws -> (output: Data, consumed: Int) {
    try SnappyDecoder.decode(Data(bytes), from: offset)
  }

  @Test func 纯字面量块() throws {
    // varint(11) + literal tag((11-1)<<2) + "hello world"
    var bytes: [UInt8] = [0x0B, 0x28]
    bytes.append(contentsOf: "hello world".utf8)
    let (out, consumed) = try decode(bytes)
    #expect(out == Data("hello world".utf8))
    #expect(consumed == bytes.count)
  }

  @Test func 扩展长度字面量() throws {
    // varint(70) + tag(60<<2) + 1 字节小端长度(70-1=69) + 70 字节
    var bytes: [UInt8] = [70, 60 << 2, 69]
    bytes.append(contentsOf: [UInt8](repeating: 0x61, count: 70))
    let (out, consumed) = try decode(bytes)
    #expect(out == Data(repeating: 0x61, count: 70))
    #expect(consumed == bytes.count)
  }

  @Test func 一字节偏移拷贝() throws {
    // literal "abcdefgh" + copy1(len 4, off 3) → 追加 "fghf"（重叠拷贝逐字节进行）
    var bytes: [UInt8] = [12, (8 - 1) << 2]
    bytes.append(contentsOf: "abcdefgh".utf8)
    bytes.append(contentsOf: [0x01, 0x03]) // copy1：len-4=0、off 高 3 位=0；次字节 off=3
    let (out, consumed) = try decode(bytes)
    #expect(out == Data("abcdefghfghf".utf8))
    #expect(consumed == bytes.count)
  }

  @Test func 一字节偏移拷贝高位偏移() throws {
    // literal 260 字节（'a'×259 + 'b'）+ copy1(len 4, off 260) → 拷贝头部 "aaaa"
    var payload = [UInt8](repeating: 0x61, count: 259)
    payload.append(0x62)
    var bytes: [UInt8] = [0x88, 0x02] // varint(264)
    bytes.append(contentsOf: [61 << 2, 0x03, 0x01]) // literal len 260：nb=2 → n=61；259 小端
    bytes.append(contentsOf: payload)
    bytes.append(contentsOf: [0x21, 0x04]) // copy1：off 高 3 位=1、len-4=0；次字节 4 → off=260
    let (out, consumed) = try decode(bytes)
    #expect(out.count == 264)
    #expect(out.suffix(4) == Data("aaaa".utf8))
    #expect(consumed == bytes.count)
  }

  @Test func 两字节偏移拷贝() throws {
    // literal "abcdefgh" + copy2(len 4, off 8) → 追加 "abcd"
    var bytes: [UInt8] = [12, (8 - 1) << 2]
    bytes.append(contentsOf: "abcdefgh".utf8)
    bytes.append(contentsOf: [((4 - 1) << 2) | 2, 0x08, 0x00])
    let (out, consumed) = try decode(bytes)
    #expect(out == Data("abcdefghabcd".utf8))
    #expect(consumed == bytes.count)
  }

  @Test func 四字节偏移拷贝() throws {
    // literal "abcdefgh" + copy4(len 4, off 8) → 追加 "abcd"
    var bytes: [UInt8] = [12, (8 - 1) << 2]
    bytes.append(contentsOf: "abcdefgh".utf8)
    bytes.append(contentsOf: [((4 - 1) << 2) | 3, 0x08, 0x00, 0x00, 0x00])
    let (out, consumed) = try decode(bytes)
    #expect(out == Data("abcdefghabcd".utf8))
    #expect(consumed == bytes.count)
  }

  @Test func 支持非零起始偏移() throws {
    let bytes: [UInt8] = [0xFF, 0xFF, 0x05, 0x10] + Array("hello".utf8)
    let (out, consumed) = try decode(bytes, from: 2)
    #expect(out == Data("hello".utf8))
    #expect(consumed == 7)
  }

  @Test func 坏varint抛badVarint() {
    #expect(throws: SnappyError.badVarint) {
      try decode([0x80, 0x80, 0x80, 0x80, 0x80, 0x80])
    }
  }

  @Test func 超长声明抛tooBig() {
    // varint(1<<24 + 1)
    #expect(throws: SnappyError.tooBig) {
      try decode([0x81, 0x80, 0x80, 0x08])
    }
  }

  @Test func 截断字面量抛malformed() {
    // varint(10) + literal tag(len 10) + 仅 3 字节负载
    #expect(throws: SnappyError.malformed) {
      try decode([10, (10 - 1) << 2, 0x61, 0x62, 0x63])
    }
  }

  @Test func 非法拷贝偏移抛malformed() {
    // 输出为空时 copy2(len 4, off 1) 无源可拷
    #expect(throws: SnappyError.malformed) {
      try decode([4, ((4 - 1) << 2) | 2, 0x01, 0x00])
    }
  }

  @Test func 输出超声明长度抛lengthMismatch() {
    // varint(4) + literal "ab" + copy2(len 4, off 2) → 输出 6 字节 > 声明 4
    #expect(throws: SnappyError.lengthMismatch) {
      try decode([4, 0x04, 0x61, 0x62, ((4 - 1) << 2) | 2, 0x02, 0x00])
    }
  }
}
