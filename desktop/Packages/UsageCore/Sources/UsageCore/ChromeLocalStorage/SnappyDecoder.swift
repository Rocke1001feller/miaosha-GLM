import Foundation

public enum SnappyError: Error, Equatable {
  case badVarint
  case tooBig
  case malformed
  case lengthMismatch
}

/// 纯 Swift 最小 raw-snappy 解码器（无第三方依赖）。
/// 格式：varint 未压缩长度 + 元素序列（4 种 opcode：literal / copy-1B-offset /
/// copy-2B-offset / copy-4B-offset）。语义与主仓探针 .tmp/leveldb_probe.py 一致
/// （该探针已在真实 Chrome leveldb 上验证可行）。
public enum SnappyDecoder {
  /// 解码 data 中 offset 处的一条 raw-snappy 流，返回解压输出与消耗的字节数。
  /// - precondition: data 的 startIndex 为 0（调用方传入完整文件 Data，勿传切片）。
  public static func decode(_ data: Data, from offset: Int) throws -> (output: Data, consumed: Int) {
    var p = offset
    // varint：未压缩长度
    var length = 0
    var shift = 0
    while true {
      guard p < data.count else { throw SnappyError.malformed }
      let b = data[p]; p += 1
      length |= Int(b & 0x7F) << shift
      if b & 0x80 == 0 { break }
      shift += 7
      if shift > 35 { throw SnappyError.badVarint }
    }
    guard length <= (1 << 24) else { throw SnappyError.tooBig }

    var out = Data()
    out.reserveCapacity(length)
    while out.count < length {
      guard p < data.count else { throw SnappyError.malformed }
      let tag = data[p]; p += 1
      switch tag & 0x3 {
      case 0: // literal
        let n = Int(tag >> 2)
        let ln: Int
        if n < 60 {
          ln = n + 1
        } else {
          let nb = n - 59
          guard p + nb <= data.count else { throw SnappyError.malformed }
          var v = 0
          for i in 0 ..< nb { v |= Int(data[p + i]) << (8 * i) }
          p += nb
          ln = v + 1
        }
        guard p + ln <= data.count else { throw SnappyError.malformed }
        out.append(contentsOf: data[p ..< p + ln]); p += ln
      case 1: // copy 1-byte offset：len=((tag>>2)&7)+4，off=((tag>>5)<<8)|次字节
        let ln = Int((tag >> 2) & 0x7) + 4
        guard p < data.count else { throw SnappyError.malformed }
        let off = (Int(tag >> 5) << 8) | Int(data[p]); p += 1
        try copyFrom(&out, offset: off, length: ln)
      case 2: // copy 2-byte offset：len=(tag>>2)+1，off=小端 2 字节
        let ln = Int(tag >> 2) + 1
        guard p + 2 <= data.count else { throw SnappyError.malformed }
        let off = Int(data[p]) | (Int(data[p + 1]) << 8); p += 2
        try copyFrom(&out, offset: off, length: ln)
      default: // copy 4-byte offset：len=(tag>>2)+1，off=小端 4 字节
        let ln = Int(tag >> 2) + 1
        guard p + 4 <= data.count else { throw SnappyError.malformed }
        var off = 0
        for i in 0 ..< 4 { off |= Int(data[p + i]) << (8 * i) }
        p += 4
        try copyFrom(&out, offset: off, length: ln)
      }
    }
    guard out.count == length else { throw SnappyError.lengthMismatch }
    return (out, p - offset)
  }

  /// 重叠拷贝逐字节进行（off 可小于 len，此时源与目标交叠）。
  private static func copyFrom(_ out: inout Data, offset off: Int, length ln: Int) throws {
    guard off > 0, off <= out.count else { throw SnappyError.malformed }
    for _ in 0 ..< ln { out.append(out[out.count - off]) }
  }
}
