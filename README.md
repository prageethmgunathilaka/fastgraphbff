# Advanced Analytics Dashboard

Real-Time Agent Management Client for LangGraph Agent Spawning System

##  Features

- **Real-Time Workflow Monitoring**: Live updates for workflows and agents via WebSocket
- **Advanced Analytics Engine**: Performance metrics, business intelligence, and trend analysis
- **Interactive Agent Management**: Detailed agent profiles with execution monitoring
- **Collaborative Operations Center**: Multi-user dashboard with role-based permissions
- **Business Intelligence Suite**: Executive reporting with ROI calculations and insights

##  Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Material-UI** for enterprise-grade UI components
- **Redux Toolkit** for state management
- **WebSocket** for real-time communication
- **Vite** for fast development and building

### Key Components
- **Dashboard**: Overview with key metrics and workflow status
- **Workflow Monitoring**: Real-time grid showing all active workflows
- **Agent Management**: Interactive console for managing individual agents
- **Analytics**: Performance and business metrics visualization
- **Reports**: Executive dashboards and automated reporting

##  Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   # Create .env file
   REACT_APP_API_BASE_URL=https://jux81vgip4.execute-api.us-east-1.amazonaws.com
   REACT_APP_WS_URL=wss://jux81vgip4.execute-api.us-east-1.amazonaws.com/ws
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

##  Configuration

The dashboard connects to the LangGraph Agent Spawning System backend. Make sure the backend service is running and accessible at the configured URLs.

### WebSocket Events
The dashboard subscribes to the following real-time events:
- `workflow_progress` - Live workflow progress updates
- `status_change` - Agent and workflow status changes
- `result_updated` - Agent completion notifications
- `error_occurred` - Error events with detailed context
- `metric_update` - Performance and business metrics
- `log_entry` - Real-time agent execution logs

##  Development

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript checks

### Project Structure
```
src/
 components/          # Reusable UI components
 pages/              # Page components
 hooks/              # Custom React hooks
 services/           # API services
 store/              # Redux store and slices
 types/              # TypeScript type definitions
 theme/              # Material-UI theme configuration
 utils/              # Utility functions
```

##  Demo Scenarios

The dashboard supports various demo scenarios as outlined in the PRD:

1. **E-Commerce Flash Sale Optimization**
2. **Healthcare Patient Data Processing Pipeline**
3. **Financial Trading Algorithm Coordination**

Each scenario demonstrates different aspects of the real-time monitoring and analytics capabilities.

##  Security

- Token-based authentication with automatic refresh
- Secure WebSocket connections (WSS)
- Role-based access control
- Data masking for sensitive information

##  Performance

- Real-time updates with <500ms latency
- Support for 50+ concurrent users
- Efficient handling of 100+ WebSocket events per second
- Optimized rendering with React.memo and virtualization

##  Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

##  License

This project is proprietary software for demonstrating LangGraph Agent Spawning System capabilities.

---

For more information, refer to the Product Requirements Document (PRD).
