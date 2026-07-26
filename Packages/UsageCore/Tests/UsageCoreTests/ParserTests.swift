import Testing
import Foundation
@testable import UsageCore

@Suite("平台解析器")
struct ParserTests {
  // MARK: - Kimi（形状同 tests/unit/usage/providers.test.ts 的 KIMI_OK）

  @Test func kimi_频限双窗口() throws {
    let json = """
    {"code":0,
     "ratelimitCode5h":{"ratio":0.3,"resetTime":"2026-07-21T05:00:00Z"},
     "ratelimitCode7d":{"ratio":0.15,"resetTime":"2026-07-28T00:00:00Z"}}
    """.data(using: .utf8)!
    let w = try #require(KimiParser.windows(from: json))
    #expect(w.count == 2)
    #expect(w[0].label == "频限明细（5h）")
    #expect(w[0].percent == 0.3)
    #expect(w[0].resetAt == Date(timeIntervalSince1970: 1_784_610_000))
    #expect(w[1].label == "本周用量")
    #expect(w[1].percent == 0.15)
    #expect(w[1].resetAt != nil)
  }

  @Test func kimi_纳秒ISO时间也能解析() throws {
    // 真实响应形状（tests/unit/usage/parsers.test.ts 的 KIMI_RESP）：resetTime 带纳秒
    let json = """
    {"ratelimitCode5h":{"ratio":0.1042,"enabled":true,"resetTime":"2026-07-18T11:38:58.274128371Z"},
     "ratelimitCode7d":{"ratio":0.4058,"enabled":true,"resetTime":"2026-07-20T06:38:58.274128371Z"},
     "subscriptionBalance":{"amountUsedRatio":0.0851}}
    """.data(using: .utf8)!
    let w = try #require(KimiParser.windows(from: json))
    #expect(w.count == 2)
    #expect(abs(w[0].percent - 0.1042) < 1e-9)
    let reset = try #require(w[0].resetAt)
    #expect(abs(reset.timeIntervalSince1970 - 1_784_374_738.274) < 0.001)
  }

  @Test func kimi_字段缺失得空数组_非法JSON得nil() {
    #expect(KimiParser.windows(from: "{}".data(using: .utf8)!) == [])
    #expect(KimiParser.windows(from: "not json".data(using: .utf8)!) == nil)
  }

  // MARK: - MiMo（形状同 providers.test.ts 的 MIMO_USAGE_OK / MIMO_DETAIL_OK）

  @Test func mimo_套餐与月用量() throws {
    let usage = """
    {"code":0,"data":{
      "usage":{"items":[{"name":"plan_total_token","percent":0.5,"used":100,"limit":200}]},
      "monthUsage":{"items":[{"percent":0.25,"used":50,"limit":200}]}}}
    """.data(using: .utf8)!
    let detail = "{\"code\":0,\"data\":{\"planName\":\"Lite\",\"currentPeriodEnd\":\"2027-05-28\"}}".data(using: .utf8)!
    let (w, plan, note) = MimoParser.windows(usage: usage, detail: detail)
    #expect(w.count == 2)
    #expect(w[0].label == "套餐用量" && w[0].percent == 0.5)
    #expect(w[0].usedText == "100 / 200")
    #expect(w[1].label == "月用量" && w[1].percent == 0.25)
    #expect(w[1].usedText == "50 / 200")
    #expect(plan == "Lite")
    #expect(note == "Lite 套餐 · 有效期至 2027-05-28")
  }

  @Test func mimo_detail缺失则无plan与note() {
    let usage = """
    {"code":0,"data":{"usage":{"items":[{"name":"plan_total_token","percent":0.5,"used":100,"limit":200}]},
      "monthUsage":{"items":[{"percent":0.25,"used":50,"limit":200}]}}}
    """.data(using: .utf8)!
    let (w, plan, note) = MimoParser.windows(usage: usage, detail: nil)
    #expect(w.count == 2)
    #expect(plan == nil)
    #expect(note == nil)
  }

  @Test func mimo_找不到plan_total_token则取第一项() {
    // TS: items.find(name==='plan_total_token') ?? items[0]
    let usage = """
    {"data":{"usage":{"items":[{"name":"other","percent":0.7,"used":7,"limit":10}]},
      "monthUsage":{"items":[]}}}
    """.data(using: .utf8)!
    let (w, _, _) = MimoParser.windows(usage: usage, detail: nil)
    #expect(w.count == 1)
    #expect(w[0].label == "套餐用量" && w[0].percent == 0.7)
  }

  // MARK: - Volc（形状同 providers.test.ts 的 VOLC_AFP_OK / VOLC_CODING_OK）

  @Test func volc_AFP三窗口与套餐名() throws {
    let afp = """
    {"Result":{"PlanType":"small",
      "AFPFiveHour":{"Quota":2000,"Used":100,"ResetTime":0},
      "AFPWeekly":{"Quota":7000,"Used":0,"ResetTime":0},
      "AFPMonthly":{"Quota":20000,"Used":900,"ResetTime":0}}}
    """.data(using: .utf8)!
    let coding = "{\"Result\":{\"Status\":\"Reclaimed\"}}".data(using: .utf8)!
    let (w, plan, note) = VolcParser.windows(afp: afp, coding: coding)
    #expect(w.count == 3)
    #expect(w[0].label == "近5小时" && abs(w[0].percent - 0.05) < 1e-9)
    #expect(w[0].usedText == "100 / 2,000")
    #expect(w[0].resetAt == nil) // ResetTime=0 → 无 resetAt
    #expect(w[1].label == "近一周" && w[1].percent == 0)
    #expect(w[2].label == "近一月" && abs(w[2].percent - 0.045) < 1e-9)
    #expect(w[2].usedText == "900 / 20,000")
    #expect(plan == "Agent Plan Small")
    #expect(note == "Coding Plan 未订阅（已回收）")
  }

  @Test func volc_usedText保留一位小数_resetAt为毫秒epoch() throws {
    // 真实抓包形状（parsers.test.ts 的 VOLC_AFP_RESP）：Used 带小数，ResetTime 为 ms
    let afp = """
    {"ResponseMetadata":{"RequestId":"req-1"},
     "Result":{"PlanType":"small",
      "AFPFiveHour":{"Quota":-1,"Used":0,"ResetTime":-1},
      "AFPMonthly":{"Quota":20000,"Used":900.8545,"SubscribeTime":1782277157000,"ResetTime":1784908799000}}}
    """.data(using: .utf8)!
    let (w, _, _) = VolcParser.windows(afp: afp, coding: nil)
    #expect(w.count == 1) // Quota<=0 的段跳过
    #expect(w[0].label == "近一月")
    #expect(abs(w[0].percent - 900.8545 / 20000) < 1e-12)
    #expect(w[0].usedText == "900.9 / 20,000")
    #expect(w[0].resetAt == Date(timeIntervalSince1970: 1_784_908_799))
  }

  @Test func volc_coding状态与note映射() {
    let afp = "{\"Result\":{\"PlanType\":\"large\"}}".data(using: .utf8)!
    // coding 为 nil → 视同未订阅（与 TS 的 codingStatus == null 分支一致）
    let (_, plan1, note1) = VolcParser.windows(afp: afp, coding: nil)
    #expect(plan1 == "Agent Plan Large")
    #expect(note1 == "Coding Plan 未订阅（已回收）")
    // Released 同样归为已回收；其他状态原样透出
    let released = "{\"Result\":{\"Status\":\"Released\"}}".data(using: .utf8)!
    #expect(VolcParser.windows(afp: afp, coding: released).2 == "Coding Plan 未订阅（已回收）")
    let active = "{\"Result\":{\"Status\":\"Active\"}}".data(using: .utf8)!
    #expect(VolcParser.windows(afp: afp, coding: active).2 == "Coding Plan Active")
    // 无 PlanType → 默认套餐名
    let noPlan = "{\"Result\":{}}".data(using: .utf8)!
    #expect(VolcParser.windows(afp: noPlan, coding: nil).1 == "Agent Plan")
  }

  // MARK: - MiniMax（形状同 tests/unit/usage/parsers.test.ts 的 MINIMAX_RESP 真实抓包）
  // 注意：字段路径以 lib/usage/parsers.ts 为准——顶层 model_remains 数组，
  // current_interval_used_percent / current_weekly_used_percent 为「已用」百分比
  //（数字 0-1 或 "4%" 字符串），不存在简报 fixture 里的 token_plan_remains / 剩余百分比。

  @Test func minimax_取general模型() throws {
    let json = """
    {"model_remains":[
      {"model_name":"general","start_time":1784358000000,"end_time":1784376000000,
       "remains_time":7666791,"current_interval_used_percent":"0%",
       "weekly_start_time":1783872000000,"weekly_end_time":1784476800000,
       "current_weekly_used_percent":"4%"},
      {"model_name":"video","current_interval_used_percent":"0%","current_weekly_used_percent":"0%"}],
     "base_resp":{"status_code":0,"status_msg":"success"}}
    """.data(using: .utf8)!
    let w = try #require(MiniMaxParser.windows(from: json))
    #expect(w.count == 2)
    #expect(w[0].label == "5h 限额" && w[0].percent == 0)
    #expect(w[0].resetAt == Date(timeIntervalSince1970: 1_784_376_000))
    #expect(w[1].label == "周限额" && abs(w[1].percent - 0.04) < 1e-9)
    #expect(w[1].resetAt == Date(timeIntervalSince1970: 1_784_476_800))
  }

  @Test func minimax_percent数字直接透传() {
    // toRatio 数字分支：0-1 已用比例原样使用
    let json = """
    {"model_remains":[{"model_name":"general",
      "current_interval_used_percent":0.21,"current_weekly_used_percent":0.04,
      "end_time":0,"weekly_end_time":-1}]}
    """.data(using: .utf8)!
    let w = MiniMaxParser.windows(from: json)
    #expect(w?.count == 2)
    #expect(w?[0].percent == 0.21)
    #expect(w?[0].resetAt == nil) // end_time<=0 → 无 resetAt
    #expect(w?[1].percent == 0.04)
  }

  @Test func minimax_无general或非法JSON得nil() {
    #expect(MiniMaxParser.windows(from: #"{"model_remains":[]}"#.data(using: .utf8)!) == nil)
    #expect(MiniMaxParser.windows(from: "null".data(using: .utf8)!) == nil)
    #expect(MiniMaxParser.windows(from: "not json".data(using: .utf8)!) == nil)
  }
}

@Suite("用量数字格式化")
struct FormatTests {
  @Test func fmtInt千分位() {
    #expect(fmtInt(100) == "100")
    #expect(fmtInt(8_162_846_607) == "8,162,846,607")
    #expect(fmtInt(49_200_000_000) == "49,200,000,000")
    #expect(fmtInt(Double.nan) == "")
    #expect(fmtInt(Double.infinity) == "")
  }

  @Test func fmtAfp千分位最多一位小数() {
    #expect(fmtAfp(0) == "0")
    #expect(fmtAfp(900) == "900")
    #expect(fmtAfp(2_000) == "2,000")
    #expect(fmtAfp(20_000) == "20,000")
    #expect(fmtAfp(900.8545) == "900.9")
    #expect(fmtAfp(900.855) == "900.9")
  }
}
