import fs from 'fs'
import path from 'path'

console.log('🔍 Starting API QuickTest Independent Build Verification...\n')

let hasErrors = false

function checkFile(relPath, minSizeBytes = 1) {
  const fullPath = path.resolve(relPath)
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${relPath}`)
    hasErrors = true
    return false
  }
  const stat = fs.statSync(fullPath)
  if (stat.size < minSizeBytes) {
    console.error(`❌ File is too small (${stat.size} bytes): ${relPath}`)
    hasErrors = true
    return false
  }
  console.log(`✅ Verified: ${relPath} (${stat.size} bytes)`)
  return true
}

// 1. Build Artifacts
console.log('--- Checking Build Outputs ---')
checkFile('dist/index.html', 100)
checkFile('server/dist/index.js', 100)

// 2. Screenshots
console.log('\n--- Checking Documentation Screenshots ---')
const expectedScreenshots = [
  'docs/screenshots/01-main-dashboard.png',
  'docs/screenshots/02-recipes-modal.png',
  'docs/screenshots/03-code-snippets.png',
  'docs/screenshots/04-environment-modal.png',
  'docs/screenshots/05-response-assertions.png',
  'docs/screenshots/06-light-theme.png',
  'docs/screenshots/07-mobile-responsive.png',
]
for (const s of expectedScreenshots) {
  checkFile(s, 1000)
}

// 3. Configuration & Workflows
console.log('\n--- Checking Deployment & CI Configs ---')
checkFile('.env.example', 50)
checkFile('render.yaml', 50)
checkFile('.github/workflows/ci.yml', 100)
checkFile('.github/workflows/deploy-pages.yml', 100)
checkFile('LICENSE', 100)
checkFile('README.md', 500)

if (hasErrors) {
  console.error('\n❌ Build verification failed with errors.')
  process.exit(1)
} else {
  console.log('\n🎉 All build outputs and assets verified successfully!')
  process.exit(0)
}
