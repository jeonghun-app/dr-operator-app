import { NextResponse } from 'next/server';
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';

// EC2 인스턴스의 IAM 역할을 사용하도록 설정
const ec2Client = new EC2Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  // credentials 설정을 제거하여 EC2 인스턴스의 IAM 역할을 사용
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vpcId = searchParams.get('vpcId');

    if (!vpcId) {
      return NextResponse.json({ error: 'VPC ID is required' }, { status: 400 });
    }

    const command = new DescribeInstancesCommand({
      Filters: [
        {
          Name: 'vpc-id',
          Values: [vpcId],
        },
      ],
    });

    const response = await ec2Client.send(command);
    
    // 인스턴스 정보 추출 및 가공
    const instances = response.Reservations?.flatMap(reservation => 
      reservation.Instances?.map(instance => ({
        instanceId: instance.InstanceId,
        state: instance.State?.Name,
        publicIp: instance.PublicIpAddress,
        privateIp: instance.PrivateIpAddress,
        instanceType: instance.InstanceType,
        tags: instance.Tags,
        availabilityZone: instance.Placement?.AvailabilityZone,
      })) || []
    ) || [];

    return NextResponse.json({ instances });
  } catch (error) {
    console.error('Error fetching EC2 instances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch EC2 instances' },
      { status: 500 }
    );
  }
} 