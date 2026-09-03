const fs = require('fs');

const files = [
  'src/routes/schemes.tsx',
  'src/routes/documents.tsx',
  'src/routes/applications.index.tsx',
  'src/routes/applications.$id.tsx',
  'src/routes/notifications.tsx',
  'src/routes/profile.tsx',
  'src/routes/admin.index.tsx',
  'src/routes/admin.agents.tsx',
  'src/routes/admin.schemes.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('sahayak_auth')) {
    if (!content.includes('redirect')) {
      content = content.replace(/import { (.*?)createFileRoute(.*?) } from "@tanstack\/react-router";/, 'import { $1createFileRoute$2, redirect } from "@tanstack/react-router";');
    }
    
    // Find where the Route is defined
    content = content.replace(/createFileRoute\((.*?)\)\(\{/, 'createFileRoute($1)({\n  beforeLoad: () => {\n    if (typeof window !== "undefined" && !localStorage.getItem("sahayak_auth")) {\n      throw redirect({ to: "/login" });\n    }\n  },');
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
