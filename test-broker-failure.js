const { Kafka, logLevel, Partitioners } = require('kafkajs');
require('dotenv').config();

const KAFKA_BROKERS = process.env.KAFKA_BROKERS 
  ? process.env.KAFKA_BROKERS.split(',') 
  : ['localhost:9091', 'localhost:9092', 'localhost:9093'];

class BrokerFailureTest {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'broker-failure-test',
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 100,
        retries: 10,
        maxRetryTime: 30000,
      },
    });
    
    this.admin = this.kafka.admin();
    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      retry: {
        retries: 5,
      },
    });
    
    this.consumer = this.kafka.consumer({
      groupId: 'failure-test-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 5000,
      retry: {
        retries: 10,
      },
    });
    
    this.testTopic = 'broker-failure-test-topic';
    this.messagesProduced = 0;
    this.messagesConsumed = 0;
    this.lastProducedOffset = null;
    this.partitionLeaders = new Map();
  }

  async setupTestTopic() {
    console.log('Setting up test topic...');
    await this.admin.connect();
    
    // Create test topic if it doesn't exist
    const topics = await this.admin.listTopics();
    if (!topics.includes(this.testTopic)) {
      await this.admin.createTopics({
        topics: [{
          topic: this.testTopic,
          numPartitions: 3,
          replicationFactor: 3,
          configEntries: [
            { name: 'min.insync.replicas', value: '2' },
          ],
        }],
      });
      console.log(`Created test topic: ${this.testTopic}`);
    }
    
    // Get partition leaders
    const metadata = await this.admin.fetchTopicMetadata({ 
      topics: [this.testTopic] 
    });
    
    if (metadata.topics[0]) {
      metadata.topics[0].partitions.forEach(partition => {
        this.partitionLeaders.set(partition.partitionId, partition.leader);
        console.log(`Partition ${partition.partitionId}: Leader = Broker ${partition.leader}, Replicas = [${partition.replicas.join(', ')}], ISR = [${partition.isr.join(', ')}]`);
      });
    }
    
    await this.admin.disconnect();
  }

  async startContinuousProduction() {
    console.log('\nStarting continuous message production...');
    await this.producer.connect();
    
    this.productionInterval = setInterval(async () => {
      try {
        const message = {
          topic: this.testTopic,
          messages: [{
            key: `key-${Date.now()}`,
            value: `Test message at ${new Date().toISOString()} - Count: ${++this.messagesProduced}`,
            timestamp: Date.now().toString(),
          }],
        };
        
        const result = await this.producer.send(message);
        
        // Track which partition and broker the message went to
        result.forEach(record => {
          console.log(`📤 Produced to partition ${record.partitionId}, offset ${record.baseOffset} (via Broker ${this.partitionLeaders.get(record.partitionId) || '?'})`);
        });
        
      } catch (error) {
        console.error('❌ Production error:', error.message);
      }
    }, 1000); // Produce every second
  }

  async startContinuousConsumption() {
    console.log('\nStarting continuous message consumption...');
    await this.consumer.connect();
    await this.consumer.subscribe({ 
      topic: this.testTopic, 
      fromBeginning: false 
    });
    
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const consumedCount = ++this.messagesConsumed;
        console.log(`📥 Consumed [${consumedCount}]: Partition ${partition}, Offset ${message.offset}, Broker: ${this.partitionLeaders.get(partition) || '?'}`);
        
        // Store last consumed offset
        this.lastProducedOffset = {
          partition,
          offset: message.offset,
          value: message.value.toString(),
        };
      },
    });
  }

  async getClusterStatus() {
    await this.admin.connect();
    
    console.log('\n📊 === CLUSTER STATUS ===');
    
    // Get cluster info
    const clusterInfo = await this.admin.describeCluster();
    console.log(`Active Brokers: ${clusterInfo.brokers.length}`);
    clusterInfo.brokers.forEach(broker => {
      console.log(`  Broker ${broker.nodeId}: ${broker.host}:${broker.port}`);
    });
    
    // Get topic metadata
    const metadata = await this.admin.fetchTopicMetadata({ 
      topics: [this.testTopic] 
    });
    
    if (metadata.topics[0]) {
      console.log(`\nTopic: ${this.testTopic}`);
      metadata.topics[0].partitions.forEach(partition => {
        const isrCount = partition.isr.length;
        const replicaCount = partition.replicas.length;
        const status = isrCount >= 2 ? '✅ HEALTHY' : '⚠️ DEGRADED';
        
        console.log(`Partition ${partition.partitionId}:`);
        console.log(`  Leader: Broker ${partition.leader}`);
        console.log(`  Replicas: [${partition.replicas.join(', ')}]`);
        console.log(`  ISR: [${partition.isr.join(', ')}] (${isrCount}/${replicaCount})`);
        console.log(`  Status: ${status}`);
      });
    }
    
    console.log(`\n📈 Stats: Produced=${this.messagesProduced}, Consumed=${this.messagesConsumed}`);
    
    await this.admin.disconnect();
  }

  async simulateBrokerFailure(brokerId) {
    console.log(`\n🚨 SIMULATING FAILURE OF BROKER ${brokerId}...`);
    
    // Stop production briefly
    if (this.productionInterval) {
      clearInterval(this.productionInterval);
    }
    
    // Kill the broker container
    const { execSync } = require('child_process');
    try {
      console.log(`Stopping broker container: kafka${brokerId}...`);
      execSync(`docker-compose stop kafka${brokerId}`, { stdio: 'inherit' });
      
      // Wait for cluster to detect failure
      console.log('Waiting for cluster to detect broker failure (30 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Check cluster status
      await this.getClusterStatus();
      
      // Resume production
      console.log('\nResuming message production after broker failure...');
      this.startContinuousProduction();
      
      // Monitor for leader re-election
      await this.monitorLeaderReElection(brokerId);
      
    } catch (error) {
      console.error('Error simulating broker failure:', error);
    }
  }

  async monitorLeaderReElection(failedBrokerId) {
    console.log(`\n👀 Monitoring leader re-election after Broker ${failedBrokerId} failure...`);
    
    let previousLeaders = new Map(this.partitionLeaders);
    
    // Check for leader changes every 10 seconds
    const monitorInterval = setInterval(async () => {
      try {
        await this.admin.connect();
        const metadata = await this.admin.fetchTopicMetadata({ 
          topics: [this.testTopic] 
        });
        
        let leadersChanged = false;
        
        if (metadata.topics[0]) {
          console.log('\nCurrent Partition Leaders:');
          metadata.topics[0].partitions.forEach(partition => {
            const previousLeader = previousLeaders.get(partition.partitionId);
            const currentLeader = partition.leader;
            const changed = previousLeader !== currentLeader;
            
            console.log(`Partition ${partition.partitionId}: ${previousLeader} → ${currentLeader} ${changed ? '🔄' : ''}`);
            
            if (changed) {
              leadersChanged = true;
              previousLeaders.set(partition.partitionId, currentLeader);
            }
          });
        }
        
        await this.admin.disconnect();
        
        // If all leaders have been re-elected away from failed broker
        const allLeaders = Array.from(previousLeaders.values());
        const noFailedBrokerLeaders = !allLeaders.includes(failedBrokerId);
        
        if (noFailedBrokerLeaders) {
          console.log('\n✅ SUCCESS: All partitions have new leaders!');
          clearInterval(monitorInterval);
        }
        
      } catch (error) {
        console.error('Monitoring error:', error.message);
      }
    }, 10000);
  }

  async restoreBroker(brokerId) {
    console.log(`\n🔧 RESTORING BROKER ${brokerId}...`);
    
    const { execSync } = require('child_process');
    try {
      console.log(`Starting broker container: kafka${brokerId}...`);
      execSync(`docker-compose start kafka${brokerId}`, { stdio: 'inherit' });
      
      console.log('Waiting for broker to rejoin cluster (45 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 45000));
      
      await this.getClusterStatus();
      
      console.log(`\n✅ Broker ${brokerId} restored successfully!`);
      
    } catch (error) {
      console.error('Error restoring broker:', error);
    }
  }

  async runCompleteTest() {
    console.log('🚀 STARTING COMPLETE BROKER FAILOVER TEST\n');
    
    try {
      // Step 1: Setup
      await this.setupTestTopic();
      
      // Step 2: Start producers and consumers
      await this.startContinuousProduction();
      await this.startContinuousConsumption();
      
      // Step 3: Initial status
      await new Promise(resolve => setTimeout(resolve, 10000)); // Let it run for 10 seconds
      await this.getClusterStatus();
      
      // Step 4: Simulate Broker 1 failure
      await this.simulateBrokerFailure(1);
      
      // Step 5: Let system run with failed broker
      console.log('\n⏳ Running with failed broker for 2 minutes...');
      await new Promise(resolve => setTimeout(resolve, 120000));
      
      // Step 6: Restore Broker 1
      await this.restoreBroker(1);
      
      // Step 7: Let system stabilize
      console.log('\n⏳ Letting system stabilize for 1 minute...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      // Step 8: Simulate Broker 2 failure
      await this.simulateBrokerFailure(2);
      
      // Step 9: Run with another failed broker
      console.log('\n⏳ Running with second failed broker for 1 minute...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      // Step 10: Final status
      await this.getClusterStatus();
      
      console.log('\n🎉 TEST COMPLETE!');
      
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      this.cleanup();
    }
  }

  async runInteractiveTest() {
    console.log('🎮 INTERACTIVE BROKER FAILOVER TEST');
    console.log('===================================');
    
    await this.setupTestTopic();
    await this.startContinuousProduction();
    await this.startContinuousConsumption();
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const menu = () => {
      console.log('\n\nCommands:');
      console.log('1 - Show cluster status');
      console.log('2 - Simulate Broker 1 failure');
      console.log('3 - Simulate Broker 2 failure');
      console.log('4 - Simulate Broker 3 failure');
      console.log('5 - Restore all brokers');
      console.log('6 - Restore specific broker');
      console.log('7 - Send test message');
      console.log('8 - Monitor ISR changes');
      console.log('q - Quit');
      
      rl.question('\nSelect option: ', async (answer) => {
        switch (answer) {
          case '1':
            await this.getClusterStatus();
            break;
          case '2':
            await this.simulateBrokerFailure(1);
            break;
          case '3':
            await this.simulateBrokerFailure(2);
            break;
          case '4':
            await this.simulateBrokerFailure(3);
            break;
          case '5':
            console.log('Restoring all brokers...');
            const { execSync } = require('child_process');
            execSync('docker-compose start kafka1 kafka2 kafka3', { stdio: 'inherit' });
            await new Promise(resolve => setTimeout(resolve, 45000));
            await this.getClusterStatus();
            break;
          case '6':
            rl.question('Enter broker ID to restore (1, 2, or 3): ', async (brokerId) => {
              await this.restoreBroker(parseInt(brokerId));
            });
            return;
          case '7':
            await this.sendTestMessage();
            break;
          case '8':
            await this.monitorISRChanges();
            break;
          case 'q':
            console.log('Exiting...');
            this.cleanup();
            rl.close();
            return;
          default:
            console.log('Invalid option');
        }
        menu();
      });
    };
    
    menu();
  }

  async sendTestMessage() {
    try {
      const message = {
        topic: this.testTopic,
        messages: [{
          key: `manual-${Date.now()}`,
          value: `Manual test message at ${new Date().toISOString()}`,
        }],
      };
      
      const result = await this.producer.send(message);
      console.log('✅ Test message sent:', result);
    } catch (error) {
      console.error('Failed to send test message:', error);
    }
  }

  async monitorISRChanges() {
    console.log('Monitoring ISR changes for 60 seconds...');
    
    const startTime = Date.now();
    const interval = setInterval(async () => {
      try {
        await this.admin.connect();
        const metadata = await this.admin.fetchTopicMetadata({ 
          topics: [this.testTopic] 
        });
        
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        console.log(`\n[${elapsed}s] ISR Status:`);
        
        if (metadata.topics[0]) {
          metadata.topics[0].partitions.forEach(partition => {
            console.log(`  Partition ${partition.partitionId}: ISR=[${partition.isr.join(', ')}]`);
          });
        }
        
        await this.admin.disconnect();
        
        if (Date.now() - startTime > 60000) {
          clearInterval(interval);
          console.log('ISR monitoring complete.');
        }
      } catch (error) {
        console.error('Monitoring error:', error.message);
      }
    }, 5000);
  }

  cleanup() {
    console.log('\nCleaning up...');
    if (this.productionInterval) {
      clearInterval(this.productionInterval);
    }
    if (this.producer) {
      this.producer.disconnect();
    }
    if (this.consumer) {
      this.consumer.disconnect();
    }
    if (this.admin) {
      this.admin.disconnect();
    }
  }
}

// Run tests
if (require.main === module) {
  const test = new BrokerFailureTest();
  const mode = process.argv[2];
  
  const cleanup = () => {
    test.cleanup();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  if (mode === 'interactive') {
    test.runInteractiveTest();
  } else {
    test.runCompleteTest();
  }
}

module.exports = BrokerFailureTest;