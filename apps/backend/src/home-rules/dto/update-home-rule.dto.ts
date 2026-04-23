import { PartialType } from '@nestjs/swagger';
import { CreateHomeRuleDto } from './create-home-rule.dto';

export class UpdateHomeRuleDto extends PartialType(CreateHomeRuleDto) {}
