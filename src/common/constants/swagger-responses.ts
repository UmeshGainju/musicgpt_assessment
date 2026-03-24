const UUID = '550e8400-e29b-41d4-a716-446655440000';
const TIMESTAMP = '2026-03-23T12:00:00.000Z';

const validationFailed = {
  success: false,
  message: 'Validation failed',
  details: [
    {
      field: 'email',
      error: ['email must be an email'],
    },
  ],
};

export const swaggerResponses = {
  auth: {
    registered: {
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: UUID,
          email: 'user@example.com',
          display_name: 'John Doe',
          subscription_status: 'FREE',
        },
        tokens: {
          access_token: 'eyJhbGciOiJIUzI1NiIs...',
          refresh_token: 'a1b2c3d4e5f6...',
        },
      },
    },
    loggedIn: {
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: UUID,
          email: 'user@example.com',
          display_name: 'John Doe',
          subscription_status: 'FREE',
        },
        tokens: {
          access_token: 'eyJhbGciOiJIUzI1NiIs...',
          refresh_token: 'a1b2c3d4e5f6...',
        },
      },
    },
    refreshed: {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        access_token: 'eyJhbGciOiJIUzI1NiIs...',
        refresh_token: 'a1b2c3d4e5f6...',
      },
    },
    loggedOut: {
      success: true,
      message: 'Logged out successfully',
    },
  },

  user: {
    fetched: {
      success: true,
      message: 'User retrieved successfully',
      data: {
        id: UUID,
        email: 'user@example.com',
        display_name: 'John Doe',
        subscription_status: 'FREE',
        created_at: TIMESTAMP,
        updated_at: TIMESTAMP,
      },
    },
    listed: {
      success: true,
      message: 'Users retrieved successfully',
      data: [
        {
          id: UUID,
          email: 'user@example.com',
          display_name: 'John Doe',
          subscription_status: 'FREE',
          created_at: TIMESTAMP,
          updated_at: TIMESTAMP,
        },
      ],
      meta: {
        next_cursor: UUID,
      },
    },
    updated: {
      success: true,
      message: 'User updated successfully',
      data: {
        id: UUID,
        email: 'user@example.com',
        display_name: 'Jane Doe',
        subscription_status: 'FREE',
        created_at: TIMESTAMP,
        updated_at: TIMESTAMP,
      },
    },
  },

  prompt: {
    created: {
      success: true,
      message: 'Prompt created successfully',
      data: {
        id: UUID,
        user_id: UUID,
        text: 'Generate a relaxing lo-fi beat',
        status: 'PENDING',
        created_at: TIMESTAMP,
        updated_at: TIMESTAMP,
      },
    },
    listed: {
      success: true,
      message: 'Prompts retrieved successfully',
      data: [
        {
          id: UUID,
          user_id: UUID,
          text: 'Generate a relaxing lo-fi beat',
          status: 'PENDING',
          created_at: TIMESTAMP,
          updated_at: TIMESTAMP,
        },
      ],
      meta: {
        next_cursor: UUID,
      },
    },
  },

  audio: {
    fetched: {
      success: true,
      message: 'Audio retrieved successfully',
      data: {
        id: UUID,
        prompt_id: UUID,
        user_id: UUID,
        title: 'Relaxing Lo-fi Beat',
        url: 'https://cdn.example.com/audio/abc123.mp3',
        created_at: TIMESTAMP,
        updated_at: TIMESTAMP,
      },
    },
    listed: {
      success: true,
      message: 'Audio list retrieved successfully',
      data: [
        {
          id: UUID,
          prompt_id: UUID,
          user_id: UUID,
          title: 'Relaxing Lo-fi Beat',
          url: 'https://cdn.example.com/audio/abc123.mp3',
          created_at: TIMESTAMP,
          updated_at: TIMESTAMP,
        },
      ],
      meta: {
        next_cursor: UUID,
      },
    },
    updated: {
      success: true,
      message: 'Audio updated successfully',
      data: {
        id: UUID,
        prompt_id: UUID,
        user_id: UUID,
        title: 'Updated Beat Title',
        url: 'https://cdn.example.com/audio/abc123.mp3',
        created_at: TIMESTAMP,
        updated_at: TIMESTAMP,
      },
    },
  },

  subscription: {
    subscribed: {
      success: true,
      message:
        'Successfully subscribed to PAID tier. You now have 100 requests/min rate limit and priority job processing.',
      data: {
        id: UUID,
        email: 'user@example.com',
        display_name: 'John Doe',
        subscription_status: 'PAID',
      },
    },
    cancelled: {
      success: true,
      message:
        'Subscription cancelled. You are now on the FREE tier with 20 requests/min rate limit.',
      data: {
        id: UUID,
        email: 'user@example.com',
        display_name: 'John Doe',
        subscription_status: 'FREE',
      },
    },
  },

  search: {
    results: {
      success: true,
      message: 'Search completed successfully',
      data: {
        users: {
          data: [
            {
              id: UUID,
              email: 'user@example.com',
              display_name: 'John Doe',
              subscription_status: 'FREE',
              created_at: TIMESTAMP,
              _score: 100,
            },
          ],
          meta: {
            next_cursor: null,
          },
        },
        audio: {
          data: [
            {
              id: UUID,
              prompt_id: UUID,
              user_id: UUID,
              title: 'Relaxing Lo-fi Beat',
              url: 'https://cdn.example.com/audio/abc123.mp3',
              created_at: TIMESTAMP,
              _score: 50,
            },
          ],
          meta: {
            next_cursor: null,
          },
        },
      },
    },
  },

  health: {
    ok: {
      success: true,
      message: 'Success',
      data: {
        status: 'ok',
        timestamp: TIMESTAMP,
      },
    },
  },

  validationFailed,
};
