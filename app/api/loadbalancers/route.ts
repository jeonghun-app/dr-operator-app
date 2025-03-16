import { NextResponse } from 'next/server';
import { 
  ElasticLoadBalancingV2Client, 
  DescribeLoadBalancersCommand,
  DescribeTagsCommand 
} from '@aws-sdk/client-elastic-load-balancing-v2';

const elbv2Client = new ElasticLoadBalancingV2Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vpcId = searchParams.get('vpcId');

    if (!vpcId) {
      return NextResponse.json({ error: 'VPC ID is required' }, { status: 400 });
    }

    // ALB 목록 가져오기
    const loadBalancersCommand = new DescribeLoadBalancersCommand({});
    const loadBalancersResponse = await elbv2Client.send(loadBalancersCommand);
    
    // VPC ID로 필터링
    const vpcLoadBalancers = loadBalancersResponse.LoadBalancers?.filter(lb => lb.VpcId === vpcId) || [];
    
    if (vpcLoadBalancers.length === 0) {
      return NextResponse.json({ loadBalancers: [] });
    }

    // ALB ARN 목록 추출
    const loadBalancerArns = vpcLoadBalancers.map(lb => lb.LoadBalancerArn || '').filter(Boolean);
    
    // Tags 정보 가져오기
    const tagsCommand = new DescribeTagsCommand({
      ResourceArns: loadBalancerArns
    });
    const tagsResponse = await elbv2Client.send(tagsCommand);
    
    // ALB 정보와 Tags 정보 결합
    const loadBalancers = vpcLoadBalancers.map(lb => {
      const tags = tagsResponse.TagDescriptions?.find(
        tagDesc => tagDesc.ResourceArn === lb.LoadBalancerArn
      )?.Tags || [];
      
      const nameTag = tags.find(tag => tag.Key === 'Name')?.Value;
      
      // DRS-WEB-ALB 또는 DRS-WAS-ALB 태그를 가진 ALB만 필터링
      if (nameTag !== 'DRS-WEB-ALB' && nameTag !== 'DRS-WAS-ALB') {
        return null;
      }

      return {
        loadBalancerArn: lb.LoadBalancerArn,
        dnsName: lb.DNSName,
        name: nameTag,
        type: lb.Type,
        scheme: lb.Scheme,
        state: lb.State?.Code,
        vpcId: lb.VpcId,
      };
    }).filter(Boolean);

    console.log('Found ALBs:', loadBalancers); // 디버깅을 위한 로그 추가

    return NextResponse.json({ loadBalancers });
  } catch (error) {
    console.error('Error fetching ALBs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ALBs' },
      { status: 500 }
    );
  }
} 