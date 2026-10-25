const checks = [
  ['Authentication', 'http://127.0.0.1:9099/'],
  ['SQL Connect', 'http://127.0.0.1:9399/'],
];

const failures = [];
for (const [name, url] of checks) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (response.status >= 500) failures.push(`${name} returned HTTP ${response.status}.`);
  } catch (error) {
    failures.push(`${name} is unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Firebase Authentication and SQL Connect emulators are reachable.');
