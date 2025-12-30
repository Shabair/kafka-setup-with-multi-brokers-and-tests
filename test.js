const { kafka } = require('./admin');

async function testProduceConsume() {
  const producer = kafka.producer();
  const consumer = kafka.consumer({ groupId: 'test-group' });

  try {
    // Connect
    await producer.connect();
    await consumer.connect();
    
    // Subscribe to test topic
    await consumer.subscribe({ topic: 'test-topic', fromBeginning: true });
    
    // Produce messages
    console.log('Producing test messages...');
    await producer.send({
      topic: 'test-topic',
      messages: [
        { key: 'key1', value: 'Hello Kafka Cluster!' },
        { key: 'key2', value: 'Testing multi-broker setup' },
        { key: 'key3', value: 'Message 3' },
      ],
    });
    
    console.log('Messages produced, starting consumer...');
    
    // Consume messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        console.log({
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString(),
          value: message.value.toString(),
        });
      },
    });
    
    // Wait for messages
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await producer.disconnect();
    await consumer.disconnect();
  }
}

// Run test
if (require.main === module) {
  testProduceConsume().catch(console.error);
}