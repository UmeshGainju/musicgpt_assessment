import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';
import { SwaggerDecorator } from '../../common/decorators/swagger.decorator';
import { swaggerResponses } from '../../common/constants/swagger-responses';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Unified search across users and audio',
    description:
      'Searches users (email, display_name) and audio (title) with weighted ranking. ' +
      'Scoring: exact match = 100, starts with = 50, contains = 10. ' +
      'Results are sorted by score descending. Each result type has its own cursor for pagination.',
  })
  @SwaggerDecorator.ApiOk(swaggerResponses.search.results)
  @SwaggerDecorator.ApiUnauthorized()
  @SwaggerDecorator.ApiPreconditionFailed(swaggerResponses.validationFailed)
  async search(@Query() query: SearchQueryDto) {
    const data = await this.searchService.search(
      query.q,
      query.users_cursor,
      query.audio_cursor,
      query.limit,
    );

    return {
      message: 'Search completed successfully',
      data,
    };
  }
}
