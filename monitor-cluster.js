const { Kafka } = require('kafkajs');
require('dotenv').config();

class ClusterMonitor {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'cluster-monitor',
      brokers: process.env.KAFKA_BROKERS.split(','),
    });
    this.admin = this.kafka.admin();
  }

  async monitorContinuously() {
    console.log('Starting continuous cluster monitoring...\n');
    
    while (true) {
      try {
        await this.admin.connect();
        
        const timestamp = new Date().toISOString();
        console.log(`\n📈 [${timestamp}] Cluster Status:`);
        
        // Get cluster info
        const clusterInfo = await this.admin.describeCluster();
        
        // Check broker status
        console.log(`Brokers: ${clusterInfo.brokers.length}/3 online`);
        clusterInfo.brokers.forEach(broker => {
          console.log(`  ✅ Broker ${broker.nodeId}: ${broker.host}:${broker.port}`);
        });
        
        // Check if any brokers are missing
        const expectedBrokers = [1, 2, 3];
        const onlineBrokers = clusterInfo.brokers.map(b => b.nodeId);
        const missingBrokers = expectedBrokers.filter(id => !onlineBrokers.includes(id));
        
        if (missingBrokers.length > 0) {
          console.log(`  ❌ Missing brokers: ${missingBrokers.join(', ')}`);
        }
        
        // Check topic partitions
        const topics = await admin.listTopics();
        const userTopics = topics.filter(t => !t.startsWith('__'));
        
        for (const topic of userTopics.slice(0, 5)) { // Check first 5 topics
          const metadata = await this.admin.fetchTopicMetadata({ topics: [topic] });
          
          if (metadata.topics[0]) {
            let unhealthyPartitions = 0;
            
            metadata.topics[0].partitions.forEach(partition => {
              if (partition.isr.length < partition.replicas.length) {
                unhealthyPartitions++;
                console.log(`  ⚠️ Topic ${topic}, Partition ${partition.partitionId}: ISR=${partition.isr.length}/${partition.replicas.length}`);
              }
            });
            
            if (unhealthyPartitions === 0) {
              console.log(`  ✅ Topic ${topic}: All partitions healthy`);
            }
          }
        }
        
        await this.admin.disconnect();
        
      } catch (error) {
        console.error(`Monitoring error: ${error.message}`);
      }
      
      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  async checkUnderReplicatedPartitions() {
    await this.admin.connect();
    
    const topics = await this.admin.listTopics();
    const userTopics = topics.filter(t => !t.startsWith('__'));
    
    console.log('\n🔍 Checking for under-replicated partitions...');
    
    for (const topic of userTopics) {
      const metadata = await this.admin.fetchTopicMetadata({ topics: [topic] });
      
      if (metadata.topics[0]) {
        metadata.topics[0].partitions.forEach(partition => {
          if (partition.isr.length < partition.replicas.length) {
            console.log(`❌ UNDER-REPLICATED: ${topic} - Partition ${partition.partitionId}`);
            console.log(`   Replicas: [${partition.replicas.join(', ')}]`);
            console.log(`   ISR: [${partition.isr.join(', ')}]`);
            console.log(`   Leader: Broker ${partition.leader}`);
          }
        });
      }
    }
    
    await this.admin.disconnect();
  }
}

// Run monitor
if (require.main === module) {
  const monitor = new ClusterMonitor();
  
  if (process.argv[2] === 'check') {
    monitor.checkUnderReplicatedPartitions();
  } else {
    monitor.monitorContinuously();
  }
}