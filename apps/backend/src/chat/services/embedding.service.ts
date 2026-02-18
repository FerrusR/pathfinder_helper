import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureOpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private embeddings!: AzureOpenAIEmbeddings;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.embeddings = new AzureOpenAIEmbeddings({
      azureOpenAIApiKey: this.configService.getOrThrow<string>('AZURE_OPENAI_API_KEY'),
      azureOpenAIEndpoint: this.configService.getOrThrow<string>('AZURE_OPENAI_ENDPOINT'),
      azureOpenAIApiDeploymentName: this.configService.getOrThrow<string>(
        'AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME',
      ),
      azureOpenAIApiInstanceName: this.configService.getOrThrow<string>('AZURE_OPENAI_API_INSTANCE_NAME'),
      azureOpenAIApiVersion: '2023-05-15',
      dimensions: 1536,
    });
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }
}
