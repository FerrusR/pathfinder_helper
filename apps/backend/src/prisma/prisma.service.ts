import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient;

  constructor(private readonly configService: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.configService.getOrThrow<string>('DATABASE_URL'),
    });
    this.client = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  // Delegate commonly used properties
  get user() {
    return this.client.user;
  }
  get invite() {
    return this.client.invite;
  }
  get campaign() {
    return this.client.campaign;
  }
  get campaignMember() {
    return this.client.campaignMember;
  }
  get homeRule() {
    return this.client.homeRule;
  }
  get ruleChunk() {
    return this.client.ruleChunk;
  }
  get homeRuleChunk() {
    return this.client.homeRuleChunk;
  }

  $queryRawUnsafe<T = unknown>(...args: Parameters<PrismaClient['$queryRawUnsafe']>): Promise<T> {
    return this.client.$queryRawUnsafe(...args) as Promise<T>;
  }

  $executeRawUnsafe(...args: Parameters<PrismaClient['$executeRawUnsafe']>): Promise<number> {
    return this.client.$executeRawUnsafe(...args) as Promise<number>;
  }

  $queryRaw<T = unknown>(...args: Parameters<PrismaClient['$queryRaw']>): Promise<T> {
    return this.client.$queryRaw(...args) as Promise<T>;
  }

  $executeRaw(...args: Parameters<PrismaClient['$executeRaw']>): Promise<number> {
    return this.client.$executeRaw(...args) as Promise<number>;
  }

  $transaction(...args: Parameters<PrismaClient['$transaction']>) {
    return (this.client.$transaction as (...a: unknown[]) => unknown)(...args);
  }
}
