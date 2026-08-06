/**
 * Post-processing script: zip the npm-run-build output directly.
 *
 * This guarantees that the released zip is byte-for-byte identical to
 * output/chrome-mv3/, avoiding any stale intermediate WXT zip issues.
 *
 * Requires: zip (macOS/Linux)
 */

import { readFileSync, existsSync, rmSync } from 'fs';
import { execSync } from 'child_process';

const OUTPUT_DIR = 'output';
const BUILD_DIR_NAME = 'chrome-mv3';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const VERSION = pkg.version;
const FINAL_ZIP = `${OUTPUT_DIR}/miaosha-glm-${VERSION}-chrome.zip`;
const BUILD_DIR = `${OUTPUT_DIR}/${BUILD_DIR_NAME}`;

function main() {
  if (!existsSync(BUILD_DIR)) {
    console.error(`Build output not found: ${BUILD_DIR}. Run "pnpm build" first.`);
    process.exit(1);
  }

  // Remove any previously generated zip with the same name.
  rmSync(FINAL_ZIP, { force: true });

  // Zip the contents of chrome-mv3/ so files appear at the zip root
  // (same layout as WXT's own zip output).
  console.log(`Creating ${FINAL_ZIP} from ${BUILD_DIR}...`);
  execSync(
    `cd "${BUILD_DIR}" && zip -r -q "../miaosha-glm-${VERSION}-chrome.zip" .`,
    { stdio: 'inherit' },
  );

  console.log(`Done: ${FINAL_ZIP}`);
}

main();
