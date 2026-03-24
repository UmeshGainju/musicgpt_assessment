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
import { UpdateUserDto } from './dto/update-user.dto';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { UserService } from './user.service';
import { SwaggerDecorator } from '../../common/decorators/swagger.decorator';
import { swaggerResponses } from '../../common/constants/swagger-responses';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users (paginated, cached)' })
  @SwaggerDecorator.ApiOk(swaggerResponses.user.listed)
  @SwaggerDecorator.ApiUnauthorized()
  async findAll(@Query() query: CursorPaginationDto) {
    const { data, meta } = await this.userService.findAll({
      cursor: query.cursor,
      limit: query.limit,
    });
    return {
      message: 'Users retrieved successfully',
      data,
      meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (cached)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @SwaggerDecorator.ApiOk(swaggerResponses.user.fetched)
  @SwaggerDecorator.ApiNotFound('User not found')
  @SwaggerDecorator.ApiUnauthorized()
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.userService.findById(id);
    return {
      message: 'User retrieved successfully',
      data,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user display name (invalidates cache)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @SwaggerDecorator.ApiOk(swaggerResponses.user.updated)
  @SwaggerDecorator.ApiNotFound('User not found')
  @SwaggerDecorator.ApiUnauthorized()
  @SwaggerDecorator.ApiPreconditionFailed(swaggerResponses.validationFailed)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const data = await this.userService.update(id, {
      display_name: dto.display_name,
    });
    return {
      message: 'User updated successfully',
      data,
    };
  }
}
