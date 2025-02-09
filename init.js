import fs from 'fs';

// Define required directories
const directories = [
	'var/data/seed',
	'var/db',
	'var/logs'
];

// Ensure directories exist
directories.forEach(dir => {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
		console.log(`✅ Created directory: ${dir}`);
	}
});

console.log('🚀 Initialization complete! Required directories are in place.');
