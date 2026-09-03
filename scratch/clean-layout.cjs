const fs = require('fs');
let code = fs.readFileSync('src/components/sahayak/layout.tsx', 'utf8');

// Remove header demo mode link
code = code.replace(/<Link to="\/demo".*?Demo mode<\/Link>/g, '');

// Remove sidebar demo mode link
code = code.replace(/<Link to="\/demo".*?Demo mode<\/Link>/g, '');

fs.writeFileSync('src/components/sahayak/layout.tsx', code);
