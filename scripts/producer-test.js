const { Kafka } = require('kafkajs');
require('dotenv').config();

const kafka = new Kafka({
  brokers: process.env.KAFKA_BROKERS.split(','),
});

const producer = kafka.producer();
const topic = 'broker-failure-test-topic';

async function run() {
  await producer.connect();
  
  let count = 0;
  
  setInterval(async () => {
    try {
      await producer.send({
        topic,
        messages: [{
          value: `Message ${++count} at ${new Date().toISOString()}`,
        }],
      });
      console.log(`✅ Produced message ${count}`);
    } catch (error) {
      console.error(`❌ Failed to produce: ${error.message}`);
    }
  }, 2000);
}

run().catch(console.error);