import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PromptService } from './prompt.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SwaggerDecorator } from '../../common/decorators/swagger.decorator';
import { swaggerResponses } from '../../common/constants/swagger-responses';

@ApiTags('Prompts')
@ApiBearerAuth()
@Controller('prompts')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit a prompt for audio generation',
    description:
      'Creates a new prompt with status PENDING. A cron job will pick it up and enqueue it for processing. PAID users get priority processing.',
  })
  @SwaggerDecorator.ApiCreated(swaggerResponses.prompt.created)
  @SwaggerDecorator.ApiUnauthorized()
  @SwaggerDecorator.ApiPreconditionFailed(swaggerResponses.validationFailed)
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePromptDto,
  ) {
    const data = await this.promptService.create(user.id, dto.text);
    return {
      message: 'Prompt created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get current user prompts (paginated, cached)' })
  @SwaggerDecorator.ApiOk(swaggerResponses.prompt.listed)
  @SwaggerDecorator.ApiUnauthorized()
  async findMine(
    @CurrentUser() user: { id: string },
    @Query() query: CursorPaginationDto,
  ) {
    const { data, meta } = await this.promptService.findByUserId(user.id, {
      cursor: query.cursor,
      limit: query.limit,
    });
    return {
      message: 'Prompts retrieved successfully',
      data,
      meta,
    };
  }
}
