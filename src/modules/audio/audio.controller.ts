import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AudioService } from './audio.service';
import { UpdateAudioDto } from './dto/update-audio.dto';
import { CursorPaginationDto } from 'src/common/dto/cursor-pagination.dto';
import { SwaggerDecorator } from 'src/common/decorators/swagger.decorator';
import { swaggerResponses } from 'src/common/constants/swagger-responses';

@ApiTags('Audio')
@ApiBearerAuth()
@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Get()
  @ApiOperation({ summary: 'Get all audio (paginated, cached)' })
  @SwaggerDecorator.ApiOk(swaggerResponses.audio.listed)
  @SwaggerDecorator.ApiUnauthorized()
  async findAll(@Query() query: CursorPaginationDto) {
    const { data, meta } = await this.audioService.findAll({
      cursor: query.cursor,
      limit: query.limit,
    });
    return {
      message: 'Audio list retrieved successfully',
      data,
      meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audio by ID (cached)' })
  @ApiParam({ name: 'id', description: 'Audio UUID' })
  @SwaggerDecorator.ApiOk(swaggerResponses.audio.fetched)
  @SwaggerDecorator.ApiNotFound('Audio not found')
  @SwaggerDecorator.ApiUnauthorized()
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.audioService.findById(id);
    return {
      message: 'Audio retrieved successfully',
      data,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update audio title (invalidates cache)' })
  @ApiParam({ name: 'id', description: 'Audio UUID' })
  @SwaggerDecorator.ApiOk(swaggerResponses.audio.updated)
  @SwaggerDecorator.ApiNotFound('Audio not found')
  @SwaggerDecorator.ApiUnauthorized()
  @SwaggerDecorator.ApiPreconditionFailed(swaggerResponses.validationFailed)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAudioDto,
  ) {
    const data = await this.audioService.update(id, { title: dto.title });
    return {
      message: 'Audio updated successfully',
      data,
    };
  }
}
