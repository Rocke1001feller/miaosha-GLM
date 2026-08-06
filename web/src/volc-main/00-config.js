// Platform configuration for the Volcengine MAIN-world overlay.
// One overlay serves both activity pages; the platform is detected at runtime
// from the page path ('/activity/agentplan' vs '/activity/codingplan').
const version =
  (typeof document !== 'undefined' && document.currentScript?.dataset?.version) ||
  (typeof chrome !== 'undefined' && chrome?.runtime?.getManifest?.()?.version) ||
  '3.0.0';

const isAgent = location.pathname.includes('agentplan');

const PLATFORM_CONFIGS = {
  agentplan: {
    platform: 'volcengine-agentplan',
    title: '火山引擎 Agent Plan',
    productCode: 'ark_subscription',
    globalName: '__activity__agentplan__',
    payPath: 'agentplan',
    defaultProductId: 'Agent_Plan_Small_monthly|duration:1',
    displayNames: {
      'Agent_Plan_Small_monthly': 'Small',
      'Agent_Plan_Medium_monthly': 'Medium',
      'Agent_Plan_Large_monthly': 'Large',
      'Agent_Plan_Max_monthly': 'Max',
    },
  },
  codingplan: {
    platform: 'volcengine-codingplan',
    title: '火山引擎 Coding Plan',
    productCode: 'ark_bd',
    globalName: '__activity__codingplan__',
    payPath: 'codingplan',
    defaultProductId: 'Coding_Plan_Lite_monthly|duration:1',
    displayNames: {
      'Coding_Plan_Lite_monthly': 'Lite',
      'Coding_Plan_Pro_monthly': 'Pro',
    },
  },
};

const config = { version: version, ...PLATFORM_CONFIGS[isAgent ? 'agentplan' : 'codingplan'] };
