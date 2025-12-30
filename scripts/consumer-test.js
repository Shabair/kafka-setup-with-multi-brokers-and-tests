const { Kafka } = require('kafkajs');
require('dotenv').config();

const kafka = new Kafka({
  brokers: process.env.KAFKA_BROKERS.split(','),
});

const consumer = kafka.consumer({ 
  groupId: 'failover-test-group' 
});

const topic = 'broker-failure-test-topic';

async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  
  let count = 0;
  
  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      console.log(`📥 Consumed [${++count}]: Partition ${partition}, Offset ${message.offset}`);
      console.log(`   ${message.value.toString()}`);
    },
  });
}

run().catch(console.error);