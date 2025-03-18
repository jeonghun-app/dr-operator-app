"use client";

// app/monitoring/page.tsx
import React, { useState, useEffect } from 'react';
import { HiServer, HiExclamationCircle, HiCheckCircle, HiXCircle } from "react-icons/hi";
import ReactFlow, {
  Edge,
  Handle,
  MiniMap,
  Controls,
  Background,
  NodeProps,
  Position,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface StatusNodeData {
  id: string;
  type: string;
  label: string;
  status: boolean;
  state?: string;
  instanceId?: string;
  publicIp?: string;
  dnsName?: string;
  availabilityZone?: string;
  nodes?: Node<StatusNodeData>[];
  groupHeight?: number;
}

interface Instance {
  id: string;
  instanceId: string;
  name: string;
  status: string;
  publicIp?: string;
  availabilityZone: string;
}

// 커스텀 노드 컴포넌트: 상태에 따라 테두리 색상을 변경 (녹색: Online, 빨간색: Offline)
const StatusNode: React.FC<NodeProps<StatusNodeData>> = ({ data }) => {
  const getStatusColor = () => {
    if (data.state === 'group') {
      return '#4a90e2'; // 그룹 노드는 파란색 테두리
    }
    if (data.state) {
      switch (data.state.toLowerCase()) {
        case "running":
          return "#22c55e"; // 초록 (정상)
        case "stopped":
          return "#f97316"; // 주황 (주의)
        case "terminated":
          return "#ef4444"; // 빨강 (심각)
        default:
          return "#94a3b8"; // 회색 (알 수 없음)
      }
    }
    return data.status ? '#22c55e' : '#ef4444';
  };

  const getStatusText = () => {
    if (data.state === 'group') {
      return ''; // 그룹 노드는 상태 텍스트 표시하지 않음
    }
    if (data.state) {
      return `Status: ${data.state}`;
    }
    return `Status: ${data.status ? 'Online' : 'Offline'}`;
  };

  const isALB = data.label?.includes('ALB');
  const isGroup = data.state === 'group';
  const borderColor = getStatusColor();
  
  return (
    <div
      style={{
        padding: 0,
        border: 'none',
        background: 'transparent',
        position: 'relative',
        width: isGroup ? 'none' : 'auto',
        height: isGroup ? 'none' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: isGroup ? 'none' : 'auto'
      }}
    >
      {isGroup ? (
        <div style={{
          background: '#1e40af',
          color: 'white',
          padding: '4px 16px',
          borderRadius: '16px',
          fontSize: '0.9rem',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          fontWeight: 500,
          pointerEvents: 'auto'
        }}>
          {data.availabilityZone}
        </div>
      ) : (
        <div style={{
          padding: 10,
          border: `2px solid ${borderColor}`,
          borderRadius: isALB ? 15 : 5,
          background: isALB 
            ? 'linear-gradient(to bottom, #f8fafc, #f1f5f9)'
            : '#ffffff',
          boxShadow: isALB
            ? '0 4px 8px rgba(0, 0, 0, 0.1)'
            : '0 2px 4px rgba(0, 0, 0, 0.05)',
          minWidth: isALB ? 180 : 150,
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: isALB ? 8 : 4 }}>
            {isALB ? (
              <>
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: '#64748b',
                  marginBottom: 2 
                }}>
                  Load Balancer
                </div>
                <strong style={{ 
                  fontSize: '1.1rem',
                  color: '#0f172a'
                }}>
                  {data.label}
                </strong>
              </>
            ) : (
              <strong style={{ 
                fontSize: '1rem',
                color: '#0f172a'
              }}>
                {data.label}
              </strong>
            )}
          </div>
          <div style={{ 
            fontSize: '0.8rem',
            color: '#64748b',
            marginBottom: isALB ? 8 : 4
          }}>
            {getStatusText()}
          </div>
          {!isALB && (
            <>
              {data.instanceId && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#64748b',
                  marginBottom: 2
                }}>
                  ID: {data.instanceId}
                </div>
              )}
              {data.publicIp && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#64748b',
                  marginBottom: 2
                }}>
                  IP: {data.publicIp}
                </div>
              )}
            </>
          )}
          {isALB && data.dnsName && (
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#64748b',
              padding: '4px 8px',
              background: '#f8fafc',
              borderRadius: 4,
              margin: '4px 0'
            }}>
              {data.dnsName}
            </div>
          )}
        </div>
      )}
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          visibility: isGroup ? 'hidden' : 'visible',
          opacity: isGroup ? 0 : 1,
          background: '#555'
        }} 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          visibility: isGroup ? 'hidden' : 'visible',
          opacity: isGroup ? 0 : 1,
          background: '#555'
        }} 
      />
    </div>
  );
};

// React Flow에 등록할 커스텀 노드 타입
const nodeTypes = {
  status: StatusNode,
  group: StatusNode,
};

export default function MonitoringPage() {
  const [nodes, setNodes] = useState<Node<StatusNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [vpcId, setVpcId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchResources = async () => {
    if (!vpcId) return;
    
    try {
      setLoading(true);
      
      // EC2 인스턴스 정보 가져오기
      const instancesResponse = await fetch(`/api/instances?vpcId=${vpcId}`);
      const instancesData = await instancesResponse.json();

      // ALB 정보 가져오기
      const albResponse = await fetch(`/api/loadbalancers?vpcId=${vpcId}`);
      const albData = await albResponse.json();

      if (instancesData.instances && albData.loadBalancers) {
        // WEB과 WAS 인스턴스만 필터링
        const filteredInstances = instancesData.instances.filter((instance: any) => {
          const nameTag = instance.tags?.find((tag: any) => tag.Key === 'Name')?.Value || '';
          return nameTag.includes('WEB-Instance') || nameTag.includes('WAS-Instance');
        });

        // WEB과 WAS ALB 필터링
        const webAlb = albData.loadBalancers.find((alb: any) => alb.name === 'DRS-WEB-ALB');
        const wasAlb = albData.loadBalancers.find((alb: any) => alb.name === 'DRS-WAS-ALB');

        // WEB 인스턴스 노드 생성 (가용영역별로 그룹화)
        const webInstances = filteredInstances.filter((instance: any) => 
          instance.tags?.find((tag: any) => tag.Key === 'Name')?.Value?.includes('WEB-Instance')
        );

        // 가용영역별로 WEB 인스턴스 그룹화
        const webInstancesByAZ = webInstances.reduce((acc: Record<string, any[]>, instance: any) => {
          const az = instance.availabilityZone;
          if (!acc[az]) {
            acc[az] = [];
          }
          acc[az].push(instance);
          return acc;
        }, {});

        // WAS 인스턴스 노드 생성 (가용영역별로 그룹화)
        const wasInstances = filteredInstances.filter((instance: any) => 
          instance.tags?.find((tag: any) => tag.Key === 'Name')?.Value?.includes('WAS-Instance')
        );

        // 가용영역별로 WAS 인스턴스 그룹화
        const wasInstancesByAZ = wasInstances.reduce((acc: Record<string, any[]>, instance: any) => {
          const az = instance.availabilityZone;
          if (!acc[az]) {
            acc[az] = [];
          }
          acc[az].push(instance);
          return acc;
        }, {});

        // 가용영역 정렬을 위한 전체 가용영역 목록 생성
        const allAZs = [...new Set([
          ...Object.keys(webInstancesByAZ),
          ...Object.keys(wasInstancesByAZ)
        ])].sort();

        // 레이아웃 설정
        const columnWidth = 400; // AZ 열 너비
        const instanceSpacing = 120; // 인스턴스 간 세로 간격
        const groupSpacing = 800; // WEB과 WAS 그룹 사이 간격
        const instancesPerRow = 2; // 한 행당 인스턴스 수를 2개로 조정
        const horizontalSpacing = 350; // 인스턴스 간 가로 간격
        const azSpacing = 300; // AZ 그룹 간 간격을 300으로 증가
        const baseOffset = 400; // 전체 그래프의 시작 X 좌표

        // 각 가용영역별 최대 인스턴스 수 계산
        const maxWebInstancesPerAZ = Math.max(...Object.values(webInstancesByAZ).map(instances => (instances as any[]).length), 0);
        const maxWasInstancesPerAZ = Math.max(...Object.values(wasInstancesByAZ).map(instances => (instances as any[]).length), 0);

        // 그룹 높이 계산 (행 수 * 간격)
        const webGroupHeight = Math.ceil(maxWebInstancesPerAZ / instancesPerRow) * instanceSpacing + 150;
        const wasGroupHeight = Math.ceil(maxWasInstancesPerAZ / instancesPerRow) * instanceSpacing + 150;

        // Y 좌표 계산
        const webAlbY = 0;
        const webGroupY = webAlbY + 200;
        const webInstanceStartY = webGroupY + 100;

        const wasAlbY = webInstanceStartY + webGroupHeight + 300;
        const wasGroupY = wasAlbY + 200;
        const wasInstanceStartY = wasGroupY + 100;

        // ALB 노드 생성
        const albNodes: Node<StatusNodeData>[] = [];
        const webNodes: Node<StatusNodeData>[] = [];
        const wasNodes: Node<StatusNodeData>[] = [];
        const centerX = baseOffset + ((allAZs.length - 1) * (columnWidth + azSpacing) / 2);
        
        if (webAlb) {
          albNodes.push({
            id: 'web-alb',
            type: 'status',
            position: { x: centerX, y: webAlbY },
            data: {
              id: 'web-alb',
              type: 'status',
              label: 'WEB ALB',
              status: true,
              state: 'active',
              dnsName: webAlb.dnsName
            }
          });
        }

        // WEB 인스턴스 노드 생성
        allAZs.forEach((az, azIndex) => {
          const instances = webInstancesByAZ[az] || [];
          const typedInstances = instances as any[];
          const columnX = baseOffset + (azIndex * (columnWidth + azSpacing));

          // 가용영역 그룹 노드 추가
          const webNode: Node<StatusNodeData> = {
            id: `web-group-${az}`,
            type: 'group',
            position: { 
              x: baseOffset + (azIndex * (columnWidth + azSpacing)), 
              y: webGroupY
            },
            data: { 
              id: `web-group-${az}`,
              type: 'group',
              label: `WEB ${az}`,
              status: true,
              state: 'group',
              availabilityZone: az,
              groupHeight: webGroupHeight
            },
          };
          webNodes.push(webNode);

          // 각 인스턴스 노드 생성
          const nodesInAZ = typedInstances.map((instance: any, index: number) => {
            const row = Math.floor(index / instancesPerRow);
            const col = index % instancesPerRow;
            const baseX = baseOffset + (azIndex * (columnWidth + azSpacing));
            return {
              id: instance.instanceId,
              type: 'status',
              position: { 
                x: baseX + (col * horizontalSpacing) - horizontalSpacing/2,
                y: webInstanceStartY + (row * instanceSpacing)
              },
              data: { 
                id: instance.instanceId,
                type: 'status',
                label: instance.name || `WEB-Instance-${index + 1}`,
                status: instance.state === 'running',
                instanceId: instance.instanceId,
                state: instance.state,
                availabilityZone: az,
                publicIp: instance.publicIp
              },
            };
          });
          webNodes.push(...nodesInAZ);
          webNode.data.nodes = nodesInAZ;
        });

        if (wasAlb) {
          albNodes.push({
            id: 'was-alb',
            type: 'status',
            position: { x: centerX, y: wasAlbY },
            data: {
              id: 'was-alb',
              type: 'status',
              label: 'WAS ALB',
              status: true,
              state: 'active',
              dnsName: wasAlb.dnsName
            }
          });
        }

        // WAS 인스턴스 노드 생성
        allAZs.forEach((az, azIndex) => {
          const instances = wasInstancesByAZ[az] || [];
          const typedInstances = instances as any[];
          const columnX = baseOffset + (azIndex * (columnWidth + azSpacing));

          // 가용영역 그룹 노드 추가
          const wasNode: Node<StatusNodeData> = {
            id: `was-group-${az}`,
            type: 'group',
            position: { 
              x: baseOffset + (azIndex * (columnWidth + azSpacing)), 
              y: wasGroupY
            },
            data: { 
              id: `was-group-${az}`,
              type: 'group',
              label: `WAS ${az}`,
              status: true,
              state: 'group',
              availabilityZone: az,
              groupHeight: wasGroupHeight
            },
          };
          wasNodes.push(wasNode);

          // 각 인스턴스 노드 생성
          const nodesInAZ = typedInstances.map((instance: any, index: number) => {
            const row = Math.floor(index / instancesPerRow);
            const col = index % instancesPerRow;
            const baseX = baseOffset + (azIndex * (columnWidth + azSpacing));
            return {
              id: instance.instanceId,
              type: 'status',
              position: { 
                x: baseX + (col * horizontalSpacing) - horizontalSpacing/2,
                y: wasInstanceStartY + (row * instanceSpacing)
              },
              data: { 
                id: instance.instanceId,
                type: 'status',
                label: instance.name || `WAS-Instance-${index + 1}`,
                status: instance.state === 'running',
                instanceId: instance.instanceId,
                state: instance.state,
                availabilityZone: az,
                publicIp: instance.publicIp
              },
            };
          });
          wasNodes.push(...nodesInAZ);
          wasNode.data.nodes = nodesInAZ;
        });

        // 모든 노드 합치기
        const newNodes: Node<StatusNodeData>[] = [
          ...albNodes,
          ...webNodes,
          ...wasNodes
        ];

        // 엣지 생성
        const newEdges: Edge[] = [];

        // WEB ALB -> 가용영역 그룹 연결
        if (webAlb) {
          allAZs.forEach((az) => {
            newEdges.push({
              id: `e-web-alb-to-group-${az}`,
              source: 'web-alb',
              target: `web-group-${az}`,
              animated: true,
              style: { stroke: '#94a3b8' }
            });
          });
        }

        // 가용영역 그룹 -> WEB 인스턴스 연결
        allAZs.forEach(az => {
          const instances = webInstancesByAZ[az] || [];
          const typedInstances = instances as any[];
          typedInstances.forEach((instance: any) => {
            newEdges.push({
              id: `e-web-group-to-instance-${az}-${instance.instanceId}`,
              source: `web-group-${az}`,
              target: instance.instanceId,
              animated: true,
              style: { stroke: '#94a3b8' }
            });
          });
        });

        // WEB 인스턴스 -> WAS ALB 연결
        if (wasAlb) {
          webInstances.forEach((instance: any) => {
            newEdges.push({
              id: `e-web-instance-to-was-alb-${instance.instanceId}`,
              source: instance.instanceId,
              target: 'was-alb',
              animated: true,
              style: { stroke: '#94a3b8' }
            });
          });
        }

        // WAS ALB -> 가용영역 그룹 연결
        if (wasAlb) {
          allAZs.forEach((az) => {
            newEdges.push({
              id: `e-was-alb-to-group-${az}`,
              source: 'was-alb',
              target: `was-group-${az}`,
              animated: true,
              style: { stroke: '#94a3b8' }
            });
          });
        }

        // 가용영역 그룹 -> WAS 인스턴스 연결
        allAZs.forEach(az => {
          const instances = wasInstancesByAZ[az] || [];
          const typedInstances = instances as any[];
          typedInstances.forEach((instance: any) => {
            newEdges.push({
              id: `e-was-group-to-instance-${az}-${instance.instanceId}`,
              source: `was-group-${az}`,
              target: instance.instanceId,
              animated: true,
              style: { stroke: '#94a3b8' }
            });
          });
        });

        setNodes(newNodes);
        setEdges(newEdges);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized && vpcId) {
      // 초기 데이터 로드
      fetchResources();

      // 10초마다 데이터 갱신
      const interval = setInterval(fetchResources, 10000);

      // 컴포넌트 언마운트 시 인터벌 정리
      return () => clearInterval(interval);
    }
  }, [vpcId, isInitialized]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsInitialized(true);
  };

  if (!isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '400px'
        }}>
          <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>VPC ID 입력</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="vpcId" style={{ display: 'block', marginBottom: '0.5rem' }}>
              VPC ID
            </label>
            <input
              type="text"
              id="vpcId"
              value={vpcId}
              onChange={(e) => setVpcId(e.target.value)}
              placeholder="vpc-xxxxxxxx"
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '1rem'
              }}
              required
            />
          </div>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0051b3'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0070f3'}
          >
            모니터링 시작
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        로딩 중...
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.3,
          minZoom: 0.5,
          maxZoom: 1.5,
        }}
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        attributionPosition="bottom-left"
        style={{ background: '#f8fafc' }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

