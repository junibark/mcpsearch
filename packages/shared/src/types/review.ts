/**
 * Review Types
 *
 * Type definitions for package reviews and ratings.
 */

export type ReviewStatus = 'visible' | 'hidden' | 'removed';

/**
 * Package review
 */
export interface Review {
  /** Unique review identifier */
  reviewId: string;

  /** Package ID being reviewed */
  packageId: string;

  /** Reviewer user ID */
  userId: string;

  /** Reviewer username (denormalized) */
  username: string;

  /** Reviewer display name (denormalized) */
  displayName: string;

  /** Reviewer avatar (denormalized) */
  userAvatar?: string;

  /** Rating (1-5 stars) */
  rating: number;

  /** Review title (optional) */
  title?: string;

  /** Review body (max 5000 chars) */
  body: string;

  /** Version that was reviewed */
  versionReviewed: string;

  /** Tool used when reviewing */
  toolUsed?: 'claudeCode' | 'cursor' | 'windsurf' | 'continueDev' | 'other';

  /** Number of "helpful" votes */
  helpfulCount: number;

  /** Number of reports */
  reportCount: number;

  /** Review visibility status */
  status: ReviewStatus;

  /** Reason for moderation action */
  moderationReason?: string;

  /** Response from package publisher */
  publisherResponse?: PublisherResponse;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt?: string;
}

/**
 * Publisher's response to a review
 */
export interface PublisherResponse {
  /** Response text */
  body: string;

  /** When the response was posted */
  respondedAt: string;

  /** User ID who responded */
  respondedBy: string;

  /** Responder's display name */
  responderName: string;
}

/**
 * Review summary for a package
 */
export interface ReviewSummary {
  /** Total number of reviews */
  totalReviews: number;

  /** Average rating (1-5) */
  averageRating: number;

  /** Rating distribution */
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };

  /** Featured review (most helpful) */
  featuredReview?: Review;
}

/**
 * Review list item (for paginated listings)
 */
export interface ReviewListItem {
  reviewId: string;
  userId: string;
  username: string;
  displayName: string;
  userAvatar?: string;
  rating: number;
  title?: string;
  body: string;
  versionReviewed: string;
  helpfulCount: number;
  hasPublisherResponse: boolean;
  createdAt: string;
}

/**
 * Helpful vote record
 */
export interface ReviewVote {
  reviewId: string;
  userId: string;
  votedAt: string;
}
