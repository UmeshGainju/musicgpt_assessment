import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SwaggerDecorator } from '../../common/decorators/swagger.decorator';
import { swaggerResponses } from '../../common/constants/swagger-responses';

@ApiTags('Subscription')
@ApiBearerAuth()
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upgrade to PAID subscription' })
  @SwaggerDecorator.ApiOk(swaggerResponses.subscription.subscribed)
  @SwaggerDecorator.ApiUnauthorized()
  @SwaggerDecorator.ApiNotFound('User not found')
  @SwaggerDecorator.ApiConflict('Already subscribed to PAID tier')
  async subscribe(@CurrentUser() user: { id: string }) {
    const data = await this.subscriptionService.subscribe(user.id);
    return {
      message:
        'Successfully subscribed to PAID tier. You now have 100 requests/min rate limit and priority job processing.',
      data,
    };
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription (downgrade to FREE)' })
  @SwaggerDecorator.ApiOk(swaggerResponses.subscription.cancelled)
  @SwaggerDecorator.ApiUnauthorized()
  @SwaggerDecorator.ApiNotFound('User not found')
  @SwaggerDecorator.ApiConflict('Already on FREE tier')
  async cancel(@CurrentUser() user: { id: string }) {
    const data = await this.subscriptionService.cancel(user.id);
    return {
      message:
        'Subscription cancelled. You are now on the FREE tier with 20 requests/min rate limit.',
      data,
    };
  }
}
