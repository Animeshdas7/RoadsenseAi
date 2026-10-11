
const hazards = [
  {
    id: 'DEMO-001',
    type: 'pothole',
    title: 'Demo pothole report',
    description: 'Sample pothole entry for testing route safety.',
    latitude: 22.8721,
    longitude: 88.4169,
    severity: 'high',
    verificationStatus: 'unverified',
    dataSource: 'demo',
    reportedAt: '2026-10-10',
  },
  {
    id: 'DEMO-002',
    type: 'waterlogging',
    title: 'Demo waterlogging report',
    description: 'Sample waterlogging entry for testing.',
    latitude: 22.5726,
    longitude: 88.3639,
    severity: 'medium',
    verificationStatus: 'unverified',
    dataSource: 'demo',
    reportedAt: '2026-10-10',
  },
  {
    id: 'DEMO-003',
    type: 'road_damage',
    title: 'Demo damaged road report',
    description: 'Sample damaged-road entry for testing.',
    latitude: 22.5958,
    longitude: 88.2636,
    severity: 'low',
    verificationStatus: 'unverified',
    dataSource: 'demo',
    reportedAt: '2026-10-10',
  },
]

export default hazards
