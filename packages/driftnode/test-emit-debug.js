const { emit } = require('./dist/emit.js');
const path = require('path');
const fs = require('fs');

const testDir = path.join(process.cwd(), '.tmp-test-debug');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir);

const ir = {
  schema_version: '1.0.0',
  source: { url: 'https://test.com', content_hash: 'abc', extracted_at: '2024-01-01T00:00:00Z' },
  base_url: 'https://api.test.com',
  auth: { type: 'api_key', location: 'header', header_name: 'X-API-Key' },
  resources: [{
    name: 'users',
    display_name: 'Users',
    description: 'User management',
    operations: [{
      name: 'list',
      display_name: 'List Users',
      description: 'Get users',
      http_method: 'GET',
      path: '/users',
      parameters: [],
      response_shape: { type: 'array', undocumented: false },
      examples: []
    }]
  }]
};

const config = { vendor: 'test', documentation: { type: 'url', url: 'https://test.com' } };

emit(ir, config, testDir).then(() => {
  console.log('Emit succeeded');
  const files = fs.readdirSync(testDir, { recursive: true });
  console.log('Files created:', JSON.stringify(files, null, 2));
  
  // Check if conformance test exists
  const testPath = path.join(testDir, 'test', 'conformance.test.ts');
  console.log('Conformance test exists:', fs.existsSync(testPath));
}).catch(err => {
  console.error('Emit failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
