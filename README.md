# Kafka Multi-Broker Cluster with Failover Testing

![Kafka Cluster](https://img.shields.io/badge/Kafka-Multi%20Broker-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-green)
![Node.js](https://img.shields.io/badge/Node.js-Admin%20Tools-yellow)
![Testing](https://img.shields.io/badge/Testing-Failover%20Tests-red)

A complete Kafka multi-broker cluster setup with comprehensive administration tools and automated failover testing. This project demonstrates Kafka's fault tolerance capabilities with a 3-broker cluster configuration, replication management, and automated testing of broker failure scenarios.

## Features

- 🚀 **3 Kafka Brokers** with full replication
- 🔒 **3 Zookeeper nodes** for high availability
- 📊 **Kafka UI** for cluster monitoring (port 8080)
- ⚙️ **Node.js Admin Tools** for topic management
- 🧪 **Automated Failover Testing** for broker failure scenarios
- 📈 **Real-time Monitoring** of cluster health
- 🛡️ **Fault Tolerance** with replication factor 3
- 🔄 **Leader Re-election** simulation and monitoring

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Kafka Cluster                          │
├──────────────┬────────────────┬─────────────────────────────┤
│   Zookeeper  │   Zookeeper 2  │      Zookeeper 3           │
│   (2181)     │    (2182)      │       (2183)               │
└──────────────┴────────────────┴─────────────────────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼────┐  ┌──────▼──────┐  ┌─────▼──────┐
│   Kafka 1  │  │   Kafka 2   │  │   Kafka 3  │
│  (19091)   │  │   (19092)   │  │   (19093)  │
│  (9091)    │  │   (9092)    │  │   (9093)   │
└────────────┘  └─────────────┘  └────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
                ┌───────▼───────┐
                │   Kafka UI    │
                │    (8080)     │
                └───────────────┘
```

## Prerequisites

- **Docker** and **Docker Compose** installed
- **Node.js** 16+ and **npm** installed
- At least **4GB RAM** available for containers
- **Git** for cloning the repository

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/kafka-multi-broker-cluster.git
cd kafka-multi-broker-cluster

# Install dependencies
npm install
```

### 2. Start the Cluster

```bash
# Start all services (3 Zookeepers + 3 Kafka brokers + Kafka UI)
docker-compose up -d

# Wait 2-3 minutes for cluster initialization
```

### 3. Check Cluster Health

```bash
# Verify all services are running
docker-compose ps

# Check Kafka cluster health
npm run cluster-health
```

### 4. Create Topics

```bash
# Create pre-defined topics with replication
npm run create-topics
```

### 5. Access Kafka UI

Open your browser and navigate to: [http://localhost:8080](http://localhost:8080)

## Project Structure

```
kafka-multi-broker-cluster/
├── docker-compose.yml          # Multi-broker cluster definition
├── admin.js                    # Main admin tool for topic management
├── test-broker-failure.js      # Automated failover testing
├── monitor-cluster.js          # Real-time cluster monitoring
├── package.json                # Node.js dependencies and scripts
├── .env                        # Environment configuration
├── .env.example                # Example environment file
├── README.md                   # This file
└── scripts/
    ├── quick-test.js          # Quick test script
    ├── producer-test.js       # Test producer
    └── consumer-test.js       # Test consumer
```

## Available Commands

### Docker Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Stop specific broker
docker-compose stop kafka1

# Start specific broker
docker-compose start kafka1

# View logs
docker-compose logs -f kafka1
```

### Admin Tools

```bash
# Cluster management
npm run cluster-health        # Check cluster health
npm run cluster-info         # Show detailed cluster information

# Topic management
npm run create-topics        # Create all pre-defined topics
npm run list-topics          # List all topics with details
npm run describe-topic -- user-registrations  # Describe specific topic
npm run delete-topic -- user-registrations    # Delete specific topic

# Monitoring
npm run monitor              # Start real-time monitoring
npm run monitor-check        # Check for under-replicated partitions
```

### Testing

```bash
# Complete automated failover test
npm run test-failover

# Interactive testing
npm run test-interactive

# Quick test
npm run quick-test

# Start test producer
npm run start-producer

# Start test consumer
npm run start-consumer
```

## Testing Broker Failover

### Automated Testing

Run the complete failover test which will:

1. Start continuous message production and consumption
2. Simulate Broker 1 failure
3. Monitor leader re-election
4. Restart Broker 1
5. Simulate Broker 2 failure
6. Verify system recovery

```bash
npm run test-failover
```

### Interactive Testing

Use the interactive menu-driven test:

```bash
npm run test-interactive
```

Menu options:
- **1**: Show cluster status
- **2**: Simulate Broker 1 failure
- **3**: Simulate Broker 2 failure
- **4**: Simulate Broker 3 failure
- **5**: Restore all brokers
- **6**: Restore specific broker
- **7**: Send test message
- **8**: Monitor ISR changes
- **q**: Quit

### Manual Testing

1. Start monitoring:
   ```bash
   npm run monitor
   ```

2. In another terminal, kill a broker:
   ```bash
   npm run kill-broker1
   ```

3. Observe in monitor output:
   - Broker 1 disappears from the list
   - Partition leaders re-elect to other brokers
   - ISR (In-Sync Replicas) adjust

4. Restore the broker:
   ```bash
   npm run restart-all
   ```

## Topic Configuration

Pre-defined topics with optimal settings:

| Topic | Partitions | Replication | Retention | Purpose |
|-------|------------|-------------|-----------|---------|
| user-registrations | 6 | 3 | 7 days | User registration events |
| order-events | 9 | 3 | 30 days | Order processing events |
| payment-transactions | 3 | 3 | 1 day | Payment transactions |
| inventory-updates | 6 | 3 | 1 GB | Inventory updates |
| notification-events | 3 | 3 | 2 days | Notification events |
| audit-logs | 3 | 3 | 1 year | System audit logs |

## Environment Configuration

Copy `.env.example` to `.env` and modify as needed:

```bash
cp .env.example .env
```

Edit `.env` file:

```env
# Kafka Cluster Configuration
KAFKA_BROKERS=localhost:9091,localhost:9092,localhost:9093
KAFKA_CLIENT_ID=kafka-cluster-admin

# Optional: SASL/SSL Configuration
# KAFKA_SASL_MECHANISM=plain
# KAFKA_SASL_USERNAME=admin
# KAFKA_SASL_PASSWORD=admin-secret
# KAFKA_SSL=true

# Admin Configuration
DEFAULT_REPLICATION_FACTOR=3
DEFAULT_PARTITIONS=3
```

## Port Mapping

| Service | Internal Port | External Port | Purpose |
|---------|---------------|---------------|---------|
| Zookeeper 1 | 2181 | 2181 | Zookeeper client |
| Zookeeper 2 | 2182 | 2182 | Zookeeper client |
| Zookeeper 3 | 2183 | 2183 | Zookeeper client |
| Kafka 1 | 19091 | 9091 | Kafka broker |
| Kafka 2 | 19092 | 9092 | Kafka broker |
| Kafka 3 | 19093 | 9093 | Kafka broker |
| Kafka UI | 8080 | 8080 | Web interface |

## Monitoring and Metrics

### Kafka UI
Access at: http://localhost:8080
- View brokers, topics, and consumer groups
- Monitor message rates and lag
- Browse topic messages

### Health Checks
```bash
# Basic health check
npm run cluster-health

# Detailed cluster info
npm run cluster-info
```

### Real-time Monitoring
```bash
# Continuous monitoring
npm run monitor

# Check replication status
npm run monitor-check
```

## Expected Failover Behavior

### When a Broker Fails:

1. **Leader Re-election**: Partitions with the failed broker as leader will elect new leaders
2. **ISR Adjustment**: Failed broker is removed from In-Sync Replicas
3. **Continued Operation**: Production/consumption continues with remaining brokers
4. **Consumer Rebalancing**: Consumers may rebalance to new brokers

### Recovery Process:

1. **Broker Restart**: Failed broker restarts and rejoins cluster
2. **Replica Sync**: Broker catches up on missed messages
3. **ISR Recovery**: Broker rejoins ISR for its partitions
4. **Leader Election**: May become leader for some partitions again

## Troubleshooting

### Common Issues

1. **Cluster not starting**:
   ```bash
   # Check logs
   docker-compose logs
   
   # Ensure ports are not in use
   sudo lsof -i :9091-9093
   ```

2. **Brokers not connecting to Zookeeper**:
   ```bash
   # Check Zookeeper logs
   docker-compose logs zookeeper
   
   # Ensure Zookeeper is running
   docker-compose ps | grep zookeeper
   ```

3. **Topics not creating**:
   ```bash
   # Check Kafka logs
   docker-compose logs kafka1
   
   # Wait for cluster initialization
   sleep 60
   ```

4. **Test failures**:
   ```bash
   # Check if all brokers are running
   npm run cluster-health
   
   # Increase wait times in test scripts
   ```

### Logs Location

- Kafka logs: `docker-compose logs kafka1 kafka2 kafka3`
- Zookeeper logs: `docker-compose logs zookeeper`
- Application logs: Check console output

## Performance Tuning

For production use, consider:

1. **Increase resources** in `docker-compose.yml`:
   ```yaml
   kafka1:
     deploy:
       resources:
         limits:
           memory: 2G
           cpus: '1.0'
   ```

2. **Adjust Kafka settings** for higher throughput:
   ```yaml
   environment:
     KAFKA_MESSAGE_MAX_BYTES: 10485880
     KAFKA_REPLICA_FETCH_MAX_BYTES: 10485760
     KAFKA_NUM_IO_THREADS: 8
     KAFKA_NUM_NETWORK_THREADS: 3
   ```

3. **Modify retention policies** based on use case

## Security Considerations

⚠️ **This setup is for development only!** For production:

1. **Enable SASL/SSL authentication**
2. **Use proper firewall rules**
3. **Implement network segmentation**
4. **Enable audit logging**
5. **Regular security updates**

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Open an issue on GitHub
3. Review Kafka documentation: [kafka.apache.org](https://kafka.apache.org/documentation/)

---

**Happy Testing!** 🚀

If you find this project useful, please give it a ⭐ on GitHub!