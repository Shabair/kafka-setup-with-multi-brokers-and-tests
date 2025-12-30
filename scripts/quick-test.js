const { execSync } = require('child_process');

console.log('🚀 Quick Kafka Failover Test');
console.log('============================\n');

async function runTest() {
  console.log('1. Checking initial cluster status...');
  execSync('node admin.js health', { stdio: 'inherit' });
  
  console.log('\n2. Creating test topic...');
  execSync('node admin.js create', { stdio: 'inherit' });
  
  console.log('\n3. Starting message producer...');
  // Start producer in background
  const { spawn } = require('child_process');
  const producer = spawn('node', ['producer-test.js'], {
    detached: true,
    stdio: 'ignore'
  });
  producer.unref();
  
  console.log('4. Starting message consumer...');
  const consumer = spawn('node', ['consumer-test.js'], {
    detached: true,
    stdio: 'ignore'
  });
  consumer.unref();
  
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log('\n5. Simulating Broker 1 failure...');
  execSync('docker-compose stop kafka1', { stdio: 'inherit' });
  
  console.log('\n6. Waiting for failover (30 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  console.log('\n7. Checking cluster status after failure...');
  execSync('node admin.js health', { stdio: 'inherit' });
  
  console.log('\n8. Restarting Broker 1...');
  execSync('docker-compose start kafka1', { stdio: 'inherit' });
  
  console.log('\n9. Waiting for recovery (45 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 45000));
  
  console.log('\n10. Final cluster status...');
  execSync('node admin.js health', { stdio: 'inherit' });
  
  console.log('\n✅ Test complete!');
  console.log('Note: Producer and consumer processes are still running.');
  console.log('Run "pkill -f producer-test.js" and "pkill -f consumer-test.js" to stop them.');
}

runTest().catch(console.error);