#!/usr/bin/env node
// Usage: node scripts/verify-eml.js alert.eml   (download from Gmail: ⋮ > Download message)
const fs = require('fs');
const { readAlert } = require('../src/alert');
readAlert(fs.readFileSync(process.argv[2])).then((r) => console.log(JSON.stringify(r, null, 2)));
