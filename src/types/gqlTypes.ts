export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  AWSDate: { input: any; output: any; }
  AWSDateTime: { input: any; output: any; }
  AWSEmail: { input: any; output: any; }
  AWSIPAddress: { input: any; output: any; }
  AWSJSON: { input: any; output: any; }
  AWSPhone: { input: any; output: any; }
  AWSTime: { input: any; output: any; }
  AWSTimestamp: { input: any; output: any; }
  AWSURL: { input: any; output: any; }
};

export type AddTicketResponseInput = {
  content: Scalars['String']['input'];
  ticketId: Scalars['ID']['input'];
};

export enum AgeRating {
  ADULT_18_PLUS = 'ADULT_18_PLUS',
  G = 'G',
  M = 'M',
  PG = 'PG',
  PG_13 = 'PG_13'
}

export enum ApprovalStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED'
}

export type ApproveFeatureRequestInput = {
  featureId: Scalars['ID']['input'];
};

export type AssignTicketInput = {
  assignedTo?: InputMaybe<Scalars['String']['input']>;
  ticketId: Scalars['ID']['input'];
};

/**
 * Types of auditable events in the system.
 * Includes impersonation, user, content, settings, and access events.
 */
export enum AuditEventType {
  ADMIN_ACCESS = 'ADMIN_ACCESS',
  COMMENT_DELETE = 'COMMENT_DELETE',
  IMPERSONATION_ACTION = 'IMPERSONATION_ACTION',
  IMPERSONATION_START = 'IMPERSONATION_START',
  IMPERSONATION_STOP = 'IMPERSONATION_STOP',
  SITE_SETTINGS_UPDATE = 'SITE_SETTINGS_UPDATE',
  STORY_DELETE = 'STORY_DELETE',
  STORY_UPDATE = 'STORY_UPDATE',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  USER_DELETE = 'USER_DELETE',
  USER_UPDATE = 'USER_UPDATE'
}

/** Audit log entry for security-sensitive operations */
export type AuditLogEntry = {
  __typename?: 'AuditLogEntry';
  details: Scalars['AWSJSON']['output'];
  eventType: AuditEventType;
  severity: AuditSeverity;
  timestamp: Scalars['AWSDateTime']['output'];
  userId: Scalars['String']['output'];
};

/** Response for audit log queries */
export type AuditLogResponse = {
  __typename?: 'AuditLogResponse';
  count: Scalars['Int']['output'];
  entries: Array<AuditLogEntry>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

/** Severity levels for audit events */
export enum AuditSeverity {
  CRITICAL = 'CRITICAL',
  INFO = 'INFO',
  WARNING = 'WARNING'
}

export type Author = {
  __typename?: 'Author';
  bio?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  source?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
  wikipediaUrl?: Maybe<Scalars['String']['output']>;
};

export type AwardBadgeInput = {
  badgeType: BadgeType;
  nodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
};

export enum BadgeType {
  AUTHOR_APPROVED = 'AUTHOR_APPROVED'
}

export type Bookmark = {
  __typename?: 'Bookmark';
  breadcrumbs: Array<Scalars['String']['output']>;
  currentNodeId: Scalars['ID']['output'];
  lastRead: Scalars['String']['output'];
  storyId: Scalars['ID']['output'];
  userId: Scalars['ID']['output'];
};

export type BookmarkConnection = {
  __typename?: 'BookmarkConnection';
  items: Array<BookmarkWithStory>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type BookmarkWithStory = {
  __typename?: 'BookmarkWithStory';
  breadcrumbs: Array<Scalars['String']['output']>;
  currentNodeId: Scalars['ID']['output'];
  lastRead: Scalars['String']['output'];
  storyCoverImage?: Maybe<Scalars['String']['output']>;
  storyGenre?: Maybe<Scalars['String']['output']>;
  storyId: Scalars['ID']['output'];
  storyTitle: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type ClipContentInput = {
  content: Scalars['String']['input'];
  draftId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
};

export type ClipboardItem = {
  __typename?: 'ClipboardItem';
  clipId: Scalars['ID']['output'];
  clippedAt: Scalars['String']['output'];
  content: Scalars['String']['output'];
  reason?: Maybe<Scalars['String']['output']>;
};

export type Comment = {
  __typename?: 'Comment';
  authorAvatarUrl?: Maybe<Scalars['String']['output']>;
  authorId: Scalars['ID']['output'];
  authorName: Scalars['String']['output'];
  authorOGSupporter?: Maybe<Scalars['Boolean']['output']>;
  authorSubscriber?: Maybe<Scalars['Boolean']['output']>;
  authorSubscriptionTier?: Maybe<SubscriptionTier>;
  commentId: Scalars['ID']['output'];
  content: Scalars['String']['output'];
  createdAt: Scalars['AWSDateTime']['output'];
  depth: Scalars['Int']['output'];
  edited?: Maybe<Scalars['Boolean']['output']>;
  nodeId: Scalars['ID']['output'];
  parentCommentId?: Maybe<Scalars['ID']['output']>;
  replies?: Maybe<Array<Comment>>;
  replyCount?: Maybe<Scalars['Int']['output']>;
  stats?: Maybe<CommentStats>;
  storyId: Scalars['ID']['output'];
  updatedAt: Scalars['AWSDateTime']['output'];
};

export type CommentConnection = {
  __typename?: 'CommentConnection';
  items: Array<Comment>;
  nextToken?: Maybe<Scalars['String']['output']>;
  total?: Maybe<Scalars['Int']['output']>;
};

export enum CommentSortBy {
  MOST_REPLIES = 'MOST_REPLIES',
  MOST_UPVOTED = 'MOST_UPVOTED',
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST'
}

export type CommentStats = {
  __typename?: 'CommentStats';
  downvotes: Scalars['Int']['output'];
  replyCount: Scalars['Int']['output'];
  totalReplyCount: Scalars['Int']['output'];
  upvotes: Scalars['Int']['output'];
};

export enum CommentVoteType {
  DOWNVOTE = 'DOWNVOTE',
  REMOVE_VOTE = 'REMOVE_VOTE',
  UPVOTE = 'UPVOTE'
}

export enum ContributionPermission {
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  FRIENDS_ONLY = 'FRIENDS_ONLY',
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC'
}

export type Contributor = {
  __typename?: 'Contributor';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type ContributorInput = {
  displayName: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type CreateCommentInput = {
  content: Scalars['String']['input'];
  nodeId: Scalars['ID']['input'];
  parentCommentId?: InputMaybe<Scalars['ID']['input']>;
  storyId: Scalars['ID']['input'];
};

export type CreateDraftInput = {
  ageRating?: InputMaybe<AgeRating>;
  content: Scalars['String']['input'];
  contentWarnings?: InputMaybe<Array<Scalars['String']['input']>>;
  nodeDescription?: InputMaybe<Scalars['String']['input']>;
  parentNodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
};

export type CreateFeatureCommentInput = {
  content: Scalars['String']['input'];
  featureId: Scalars['ID']['input'];
};

export type CreateFeatureRequestInput = {
  category: FeatureCategory;
  description: Scalars['String']['input'];
  title: Scalars['String']['input'];
};

export type CreateNodeInput = {
  ageRating?: InputMaybe<AgeRating>;
  aiCreated?: InputMaybe<Scalars['Boolean']['input']>;
  content: Scalars['String']['input'];
  contentWarnings?: InputMaybe<Array<Scalars['String']['input']>>;
  nodeDescription?: InputMaybe<Scalars['String']['input']>;
  parentNodeId?: InputMaybe<Scalars['ID']['input']>;
  storyId: Scalars['ID']['input'];
  storyTitle?: InputMaybe<Scalars['String']['input']>;
};

export type CreateNotificationInput = {
  message: Scalars['String']['input'];
  relatedNodeId?: InputMaybe<Scalars['ID']['input']>;
  relatedStoryId?: InputMaybe<Scalars['ID']['input']>;
  relatedUserId?: InputMaybe<Scalars['ID']['input']>;
  type: NotificationType;
  userId: Scalars['ID']['input'];
};

export type CreateStoryInput = {
  ageRating: AgeRating;
  aiCreated?: InputMaybe<Scalars['Boolean']['input']>;
  allowAI?: InputMaybe<Scalars['Boolean']['input']>;
  contentWarnings: Array<Scalars['String']['input']>;
  contributionPermission?: InputMaybe<ContributionPermission>;
  coverImageTopUrl?: InputMaybe<Scalars['String']['input']>;
  coverImageUrl?: InputMaybe<Scalars['String']['input']>;
  genre: Array<Scalars['String']['input']>;
  ratingExplanation?: InputMaybe<Scalars['String']['input']>;
  synopsis: Scalars['String']['input'];
  title: Scalars['String']['input'];
};

export type CreateSupportTicketInput = {
  category: TicketCategory;
  description: Scalars['String']['input'];
  subject: Scalars['String']['input'];
};

export type DeleteCommentInput = {
  commentId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
};

export type DeleteCommentResponse = {
  __typename?: 'DeleteCommentResponse';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type DeleteFeatureCommentInput = {
  commentId: Scalars['ID']['input'];
  featureId: Scalars['ID']['input'];
};

export type DraftConnection = {
  __typename?: 'DraftConnection';
  items: Array<DraftNode>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type DraftNode = {
  __typename?: 'DraftNode';
  ageRating?: Maybe<AgeRating>;
  approvalStatus?: Maybe<ApprovalStatus>;
  authorId: Scalars['String']['output'];
  authorName: Scalars['String']['output'];
  clipboardItems: Array<ClipboardItem>;
  content: Scalars['String']['output'];
  contentWarnings?: Maybe<Array<Scalars['String']['output']>>;
  createdAt: Scalars['String']['output'];
  currentVersionNumber: Scalars['Int']['output'];
  draftId: Scalars['ID']['output'];
  nodeDescription?: Maybe<Scalars['String']['output']>;
  parentNodeId: Scalars['ID']['output'];
  peerReviews: Array<PeerReview>;
  reviewedAt?: Maybe<Scalars['String']['output']>;
  reviewerId?: Maybe<Scalars['String']['output']>;
  reviewerNotes?: Maybe<Scalars['String']['output']>;
  status: DraftStatus;
  storyId: Scalars['ID']['output'];
  updatedAt: Scalars['String']['output'];
  versions: Array<DraftVersion>;
};

export enum DraftStatus {
  ABANDONED = 'ABANDONED',
  APPROVED = 'APPROVED',
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
  SUBMITTED = 'SUBMITTED'
}

export type DraftVersion = {
  __typename?: 'DraftVersion';
  ageRating?: Maybe<AgeRating>;
  content: Scalars['String']['output'];
  contentWarnings?: Maybe<Array<Scalars['String']['output']>>;
  createdAt: Scalars['String']['output'];
  nodeDescription?: Maybe<Scalars['String']['output']>;
  note?: Maybe<Scalars['String']['output']>;
  versionNumber: Scalars['Int']['output'];
};

export enum FeatureCategory {
  ANALYTICS = 'ANALYTICS',
  COMMUNITY = 'COMMUNITY',
  MOBILE = 'MOBILE',
  MODERATION = 'MODERATION',
  OTHER = 'OTHER',
  PERFORMANCE = 'PERFORMANCE',
  STORY_WRITING = 'STORY_WRITING',
  USER_EXPERIENCE = 'USER_EXPERIENCE'
}

export type FeatureComment = {
  __typename?: 'FeatureComment';
  authorId: Scalars['String']['output'];
  authorName: Scalars['String']['output'];
  authorOGSupporter?: Maybe<Scalars['Boolean']['output']>;
  authorSubscriber?: Maybe<Scalars['Boolean']['output']>;
  authorSubscriptionTier?: Maybe<SubscriptionTier>;
  commentId: Scalars['ID']['output'];
  content: Scalars['String']['output'];
  createdAt: Scalars['AWSDateTime']['output'];
  edited?: Maybe<Scalars['Boolean']['output']>;
  featureId: Scalars['ID']['output'];
  updatedAt?: Maybe<Scalars['AWSDateTime']['output']>;
};

export type FeatureCommentConnection = {
  __typename?: 'FeatureCommentConnection';
  items: Array<FeatureComment>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type FeatureConnection = {
  __typename?: 'FeatureConnection';
  items: Array<FeatureRequest>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type FeatureFilter = {
  category?: InputMaybe<FeatureCategory>;
  status?: InputMaybe<FeatureStatus>;
};

export type FeatureRequest = {
  __typename?: 'FeatureRequest';
  approvedAt?: Maybe<Scalars['AWSDateTime']['output']>;
  approvedBy?: Maybe<Scalars['String']['output']>;
  category: FeatureCategory;
  commentCount: Scalars['Int']['output'];
  completedAt?: Maybe<Scalars['AWSDateTime']['output']>;
  createdAt: Scalars['AWSDateTime']['output'];
  description: Scalars['String']['output'];
  featureId: Scalars['ID']['output'];
  rejectionReason?: Maybe<Scalars['String']['output']>;
  status: FeatureStatus;
  submittedBy: Scalars['String']['output'];
  submittedByName: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['AWSDateTime']['output'];
  voteCount: Scalars['Int']['output'];
};

export enum FeatureSortBy {
  MOST_VOTED = 'MOST_VOTED',
  NEWEST = 'NEWEST',
  RECENTLY_UPDATED = 'RECENTLY_UPDATED'
}

export enum FeatureStatus {
  COMPLETED = 'COMPLETED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PROPOSED = 'PROPOSED',
  REJECTED = 'REJECTED'
}

export type FeatureVote = {
  __typename?: 'FeatureVote';
  createdAt: Scalars['AWSDateTime']['output'];
  featureId: Scalars['ID']['output'];
  userId: Scalars['ID']['output'];
};

export type GetUploadUrlInput = {
  fileName: Scalars['String']['input'];
  fileSize: Scalars['Int']['input'];
  fileType: Scalars['String']['input'];
  uploadType: UploadType;
};

export type ImpersonationSession = {
  __typename?: 'ImpersonationSession';
  adminUserId: Scalars['ID']['output'];
  expiresAt: Scalars['String']['output'];
  impersonatedEmail: Scalars['String']['output'];
  impersonatedUserId: Scalars['ID']['output'];
  impersonatedUsername: Scalars['String']['output'];
  ogSupporter: Scalars['Boolean']['output'];
  requestOrigin?: Maybe<Scalars['String']['output']>;
  sessionId: Scalars['ID']['output'];
  sessionToken: Scalars['String']['output'];
  startedAt: Scalars['String']['output'];
  subscriber: Scalars['Boolean']['output'];
};

export type ImpersonationStatus = {
  __typename?: 'ImpersonationStatus';
  isImpersonating: Scalars['Boolean']['output'];
  session?: Maybe<ImpersonationSession>;
};

export type Mutation = {
  __typename?: 'Mutation';
  abandonDraft: Scalars['Boolean']['output'];
  addFavoriteContributor: User;
  addTicketResponse?: Maybe<SupportTicket>;
  approveDraft: DraftNode;
  approveFeatureRequest?: Maybe<FeatureRequest>;
  assignTicket?: Maybe<SupportTicket>;
  awardBadge?: Maybe<StoryNode>;
  clipContent: DraftNode;
  closeSupportTicket?: Maybe<SupportTicket>;
  createComment?: Maybe<Comment>;
  createDraft: DraftNode;
  createFeatureComment?: Maybe<FeatureComment>;
  createFeatureRequest?: Maybe<FeatureRequest>;
  createNode?: Maybe<StoryNode>;
  createNotification?: Maybe<Notification>;
  createStory?: Maybe<Story>;
  createSupportTicket?: Maybe<SupportTicket>;
  deleteBookmark?: Maybe<Scalars['Boolean']['output']>;
  deleteClip: DraftNode;
  deleteComment?: Maybe<DeleteCommentResponse>;
  deleteDraft: Scalars['Boolean']['output'];
  deleteFeatureComment?: Maybe<Scalars['Boolean']['output']>;
  deleteFeatureRequest?: Maybe<Scalars['Boolean']['output']>;
  getUploadUrl?: Maybe<UploadUrl>;
  incrementStoryReads?: Maybe<StoryStats>;
  markAllNotificationsAsRead: Scalars['Boolean']['output'];
  markNotificationAsRead?: Maybe<Notification>;
  publishDraft: StoryNode;
  rateStory?: Maybe<Story>;
  rejectDraft: DraftNode;
  rejectFeatureRequest?: Maybe<FeatureRequest>;
  removeFavoriteContributor: User;
  removeVoteFromFeature?: Maybe<UserVoteSummary>;
  requestDraftRevision: DraftNode;
  requestPeerReview: DraftNode;
  restoreClip: DraftNode;
  revokeImpersonationSession: RevokeSessionResult;
  saveBookmark?: Maybe<Bookmark>;
  saveDraftVersion: DraftNode;
  startImpersonation: ImpersonationSession;
  stopImpersonation: Scalars['Boolean']['output'];
  submitDraftForReview: DraftNode;
  submitPeerReview: DraftNode;
  updateComment?: Maybe<Comment>;
  updateDraft: DraftNode;
  updateFeatureComment?: Maybe<FeatureComment>;
  updateFeatureRequest?: Maybe<FeatureRequest>;
  updateFeatureStatus?: Maybe<FeatureRequest>;
  updateNode?: Maybe<StoryNode>;
  updateSiteSettings: SiteSettings;
  updateStory?: Maybe<Story>;
  updateTicketStatus?: Maybe<SupportTicket>;
  updateUserProfile: User;
  updateUserSettings: User;
  verifyMFACode: Scalars['Boolean']['output'];
  voteOnComment?: Maybe<Comment>;
  voteOnFeature?: Maybe<UserVoteSummary>;
  voteOnNode?: Maybe<StoryNode>;
};


export type MutationAbandonDraftArgs = {
  draftId: Scalars['ID']['input'];
};


export type MutationAddFavoriteContributorArgs = {
  contributorId: Scalars['ID']['input'];
};


export type MutationAddTicketResponseArgs = {
  input: AddTicketResponseInput;
};


export type MutationApproveDraftArgs = {
  draftId: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
};


export type MutationApproveFeatureRequestArgs = {
  input: ApproveFeatureRequestInput;
  mfaCode?: InputMaybe<Scalars['String']['input']>;
};


export type MutationAssignTicketArgs = {
  input: AssignTicketInput;
};


export type MutationAwardBadgeArgs = {
  input: AwardBadgeInput;
};


export type MutationClipContentArgs = {
  input: ClipContentInput;
};


export type MutationCloseSupportTicketArgs = {
  ticketId: Scalars['ID']['input'];
};


export type MutationCreateCommentArgs = {
  input: CreateCommentInput;
};


export type MutationCreateDraftArgs = {
  input: CreateDraftInput;
};


export type MutationCreateFeatureCommentArgs = {
  input: CreateFeatureCommentInput;
};


export type MutationCreateFeatureRequestArgs = {
  input: CreateFeatureRequestInput;
};


export type MutationCreateNodeArgs = {
  input: CreateNodeInput;
};


export type MutationCreateNotificationArgs = {
  input: CreateNotificationInput;
};


export type MutationCreateStoryArgs = {
  input: CreateStoryInput;
};


export type MutationCreateSupportTicketArgs = {
  input: CreateSupportTicketInput;
};


export type MutationDeleteBookmarkArgs = {
  storyId: Scalars['ID']['input'];
};


export type MutationDeleteClipArgs = {
  clipId: Scalars['ID']['input'];
  draftId: Scalars['ID']['input'];
};


export type MutationDeleteCommentArgs = {
  input: DeleteCommentInput;
};


export type MutationDeleteDraftArgs = {
  draftId: Scalars['ID']['input'];
};


export type MutationDeleteFeatureCommentArgs = {
  input: DeleteFeatureCommentInput;
};


export type MutationDeleteFeatureRequestArgs = {
  featureId: Scalars['ID']['input'];
};


export type MutationGetUploadUrlArgs = {
  input: GetUploadUrlInput;
};


export type MutationIncrementStoryReadsArgs = {
  storyId: Scalars['ID']['input'];
};


export type MutationMarkAllNotificationsAsReadArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationMarkNotificationAsReadArgs = {
  notificationId: Scalars['ID']['input'];
};


export type MutationPublishDraftArgs = {
  draftId: Scalars['ID']['input'];
};


export type MutationRateStoryArgs = {
  rating: Scalars['Int']['input'];
  storyId: Scalars['ID']['input'];
};


export type MutationRejectDraftArgs = {
  draftId: Scalars['ID']['input'];
  notes: Scalars['String']['input'];
};


export type MutationRejectFeatureRequestArgs = {
  input: RejectFeatureRequestInput;
  mfaCode?: InputMaybe<Scalars['String']['input']>;
};


export type MutationRemoveFavoriteContributorArgs = {
  contributorId: Scalars['ID']['input'];
};


export type MutationRemoveVoteFromFeatureArgs = {
  input: RemoveVoteInput;
};


export type MutationRequestDraftRevisionArgs = {
  draftId: Scalars['ID']['input'];
  notes: Scalars['String']['input'];
};


export type MutationRequestPeerReviewArgs = {
  draftId: Scalars['ID']['input'];
  reviewerIds: Array<Scalars['ID']['input']>;
};


export type MutationRestoreClipArgs = {
  clipId: Scalars['ID']['input'];
  draftId: Scalars['ID']['input'];
};


export type MutationRevokeImpersonationSessionArgs = {
  reason?: InputMaybe<Scalars['String']['input']>;
  targetAdminUserId: Scalars['ID']['input'];
};


export type MutationSaveBookmarkArgs = {
  input: SaveBookmarkInput;
};


export type MutationSaveDraftVersionArgs = {
  input: SaveDraftVersionInput;
};


export type MutationStartImpersonationArgs = {
  mfaCode?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type MutationSubmitDraftForReviewArgs = {
  draftId: Scalars['ID']['input'];
};


export type MutationSubmitPeerReviewArgs = {
  input: SubmitPeerReviewInput;
};


export type MutationUpdateCommentArgs = {
  input: UpdateCommentInput;
};


export type MutationUpdateDraftArgs = {
  input: UpdateDraftInput;
};


export type MutationUpdateFeatureCommentArgs = {
  input: UpdateFeatureCommentInput;
};


export type MutationUpdateFeatureRequestArgs = {
  input: UpdateFeatureRequestInput;
};


export type MutationUpdateFeatureStatusArgs = {
  input: UpdateFeatureStatusInput;
  mfaCode?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateNodeArgs = {
  input: UpdateNodeInput;
};


export type MutationUpdateSiteSettingsArgs = {
  input: UpdateSiteSettingsInput;
  mfaCode?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateStoryArgs = {
  input: UpdateStoryInput;
};


export type MutationUpdateTicketStatusArgs = {
  input: UpdateTicketStatusInput;
};


export type MutationUpdateUserProfileArgs = {
  input: UpdateUserProfileInput;
};


export type MutationUpdateUserSettingsArgs = {
  input: UpdateUserSettingsInput;
};


export type MutationVerifyMfaCodeArgs = {
  code: Scalars['String']['input'];
};


export type MutationVoteOnCommentArgs = {
  commentId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
  voteType: CommentVoteType;
};


export type MutationVoteOnFeatureArgs = {
  input: VoteOnFeatureInput;
};


export type MutationVoteOnNodeArgs = {
  nodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
  voteType: VoteType;
};

export type NodeBadges = {
  __typename?: 'NodeBadges';
  authorApproved: Scalars['Boolean']['output'];
};

export type NodeStats = {
  __typename?: 'NodeStats';
  childNodes: Scalars['Int']['output'];
  downvotes: Scalars['Int']['output'];
  reads: Scalars['Int']['output'];
  upvotes: Scalars['Int']['output'];
};

export type Notification = {
  __typename?: 'Notification';
  createdAt: Scalars['String']['output'];
  message: Scalars['String']['output'];
  notificationId: Scalars['ID']['output'];
  read: Scalars['Boolean']['output'];
  relatedNodeId?: Maybe<Scalars['ID']['output']>;
  relatedStoryId?: Maybe<Scalars['ID']['output']>;
  relatedUserId?: Maybe<Scalars['ID']['output']>;
  type: NotificationType;
  userId: Scalars['ID']['output'];
};

export type NotificationConnection = {
  __typename?: 'NotificationConnection';
  items: Array<Notification>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export enum NotificationFrequency {
  DAILY_DIGEST = 'DAILY_DIGEST',
  IMMEDIATE = 'IMMEDIATE',
  NEVER = 'NEVER',
  WEEKLY_DIGEST = 'WEEKLY_DIGEST'
}

export enum NotificationType {
  AUTHOR_RESPONSE = 'AUTHOR_RESPONSE',
  BADGE_AWARDED = 'BADGE_AWARDED',
  NEW_BRANCH = 'NEW_BRANCH',
  VOTE_RECEIVED = 'VOTE_RECEIVED'
}

export type PeerReview = {
  __typename?: 'PeerReview';
  createdAt: Scalars['String']['output'];
  feedback?: Maybe<Scalars['String']['output']>;
  rating?: Maybe<Scalars['Int']['output']>;
  reviewerId: Scalars['ID']['output'];
  reviewerName: Scalars['String']['output'];
};

export enum ProfileVisibility {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC'
}

export type Query = {
  __typename?: 'Query';
  checkEmailHasGoogleAccount: Scalars['Boolean']['output'];
  checkUsernameAvailability: UsernameAvailability;
  getAuditLogs: AuditLogResponse;
  getAuthor?: Maybe<Author>;
  getBookmark?: Maybe<Bookmark>;
  getComment?: Maybe<Comment>;
  getDraft?: Maybe<DraftNode>;
  getFeature?: Maybe<FeatureRequest>;
  getImpersonationStatus: ImpersonationStatus;
  getNode?: Maybe<StoryNode>;
  getReadingPath: Array<StoryNode>;
  getReceivedCommentVotes: ReceivedCommentVotesConnection;
  getReceivedNodeVotes: ReceivedNodeVotesConnection;
  getSiteSettings: SiteSettings;
  getStory?: Maybe<Story>;
  getStoryTree?: Maybe<TreeData>;
  getSupportTicket?: Maybe<SupportTicket>;
  getTicketStats?: Maybe<TicketStats>;
  getUnreadCount: Scalars['Int']['output'];
  getUserContributions?: Maybe<UserContributionsConnection>;
  getUserNotifications?: Maybe<NotificationConnection>;
  getUserProfile?: Maybe<User>;
  getUserVoteSummary?: Maybe<UserVoteSummary>;
  getUsersByFavoriteAuthor: UsersByTagConnection;
  getUsersByFavoriteContributor: UsersByTagConnection;
  getUsersByInterest: UsersByTagConnection;
  listAllTickets?: Maybe<SupportTicketConnection>;
  listAllUsers: UserListResponse;
  listBookmarks?: Maybe<BookmarkConnection>;
  listChildNodes: Array<StoryNode>;
  listComments?: Maybe<CommentConnection>;
  listDraftsPendingReview: DraftConnection;
  listFeatureComments?: Maybe<FeatureCommentConnection>;
  listFeatures?: Maybe<FeatureConnection>;
  listMyDrafts: DraftConnection;
  listMyTickets?: Maybe<SupportTicketConnection>;
  listPendingFeatures?: Maybe<FeatureConnection>;
  listReplies?: Maybe<CommentConnection>;
  listStories?: Maybe<StoryConnection>;
  listSupporters: SupportersConnection;
  searchContributors: Array<Contributor>;
  suggestAuthors: Array<TagSuggestion>;
  suggestInterests: Array<TagSuggestion>;
};


export type QueryCheckEmailHasGoogleAccountArgs = {
  email: Scalars['String']['input'];
};


export type QueryCheckUsernameAvailabilityArgs = {
  username: Scalars['String']['input'];
};


export type QueryGetAuditLogsArgs = {
  endDate?: InputMaybe<Scalars['AWSDateTime']['input']>;
  eventType?: InputMaybe<AuditEventType>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['AWSDateTime']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetAuthorArgs = {
  name: Scalars['String']['input'];
};


export type QueryGetBookmarkArgs = {
  storyId: Scalars['ID']['input'];
};


export type QueryGetCommentArgs = {
  commentId: Scalars['ID']['input'];
  includeReplies?: InputMaybe<Scalars['Boolean']['input']>;
  nodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
};


export type QueryGetDraftArgs = {
  draftId: Scalars['ID']['input'];
};


export type QueryGetFeatureArgs = {
  featureId: Scalars['ID']['input'];
};


export type QueryGetNodeArgs = {
  nodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
};


export type QueryGetReadingPathArgs = {
  nodePath: Array<Scalars['ID']['input']>;
  storyId: Scalars['ID']['input'];
};


export type QueryGetReceivedCommentVotesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type QueryGetReceivedNodeVotesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type QueryGetStoryArgs = {
  storyId: Scalars['ID']['input'];
};


export type QueryGetStoryTreeArgs = {
  storyId: Scalars['ID']['input'];
};


export type QueryGetSupportTicketArgs = {
  ticketId: Scalars['ID']['input'];
};


export type QueryGetUnreadCountArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryGetUserContributionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type QueryGetUserNotificationsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type QueryGetUserProfileArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryGetUsersByFavoriteAuthorArgs = {
  author: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGetUsersByFavoriteContributorArgs = {
  contributorId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGetUsersByInterestArgs = {
  interest: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListAllTicketsArgs = {
  filter?: InputMaybe<TicketFilter>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<TicketSortBy>;
};


export type QueryListAllUsersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListBookmarksArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListChildNodesArgs = {
  nodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
};


export type QueryListCommentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  nodeId: Scalars['ID']['input'];
  sortBy?: InputMaybe<CommentSortBy>;
  storyId: Scalars['ID']['input'];
};


export type QueryListDraftsPendingReviewArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  storyId: Scalars['ID']['input'];
};


export type QueryListFeatureCommentsArgs = {
  featureId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListFeaturesArgs = {
  filter?: InputMaybe<FeatureFilter>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<FeatureSortBy>;
};


export type QueryListMyDraftsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<DraftStatus>;
  storyId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryListMyTicketsArgs = {
  filter?: InputMaybe<TicketFilter>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<TicketSortBy>;
};


export type QueryListPendingFeaturesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListRepliesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  nodeId: Scalars['ID']['input'];
  parentCommentId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
};


export type QueryListStoriesArgs = {
  filter?: InputMaybe<StoryFilter>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySearchContributorsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  prefix: Scalars['String']['input'];
};


export type QuerySuggestAuthorsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  prefix: Scalars['String']['input'];
};


export type QuerySuggestInterestsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  prefix: Scalars['String']['input'];
};

export type ReceivedCommentVote = {
  __typename?: 'ReceivedCommentVote';
  commentId: Scalars['ID']['output'];
  commentPreview?: Maybe<Scalars['String']['output']>;
  nodeId: Scalars['ID']['output'];
  storyId: Scalars['ID']['output'];
  voteType: CommentVoteType;
  votedAt: Scalars['AWSDateTime']['output'];
  voterId: Scalars['ID']['output'];
  voterName: Scalars['String']['output'];
};

export type ReceivedCommentVotesConnection = {
  __typename?: 'ReceivedCommentVotesConnection';
  items: Array<ReceivedCommentVote>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type ReceivedNodeVote = {
  __typename?: 'ReceivedNodeVote';
  nodeId: Scalars['ID']['output'];
  nodePreview?: Maybe<Scalars['String']['output']>;
  storyId: Scalars['ID']['output'];
  storyTitle?: Maybe<Scalars['String']['output']>;
  voteType: VoteType;
  votedAt: Scalars['AWSDateTime']['output'];
  voterId: Scalars['ID']['output'];
  voterName: Scalars['String']['output'];
};

export type ReceivedNodeVotesConnection = {
  __typename?: 'ReceivedNodeVotesConnection';
  items: Array<ReceivedNodeVote>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type RejectFeatureRequestInput = {
  featureId: Scalars['ID']['input'];
  rejectionReason?: InputMaybe<Scalars['String']['input']>;
};

export type RemoveVoteInput = {
  featureId: Scalars['ID']['input'];
};

export type RevokeSessionResult = {
  __typename?: 'RevokeSessionResult';
  reason?: Maybe<Scalars['String']['output']>;
  revokedAdminUserId: Scalars['ID']['output'];
  success: Scalars['Boolean']['output'];
};

export type SaveBookmarkInput = {
  breadcrumbs: Array<Scalars['String']['input']>;
  currentNodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
};

export type SaveDraftVersionInput = {
  ageRating?: InputMaybe<AgeRating>;
  content: Scalars['String']['input'];
  contentWarnings?: InputMaybe<Array<Scalars['String']['input']>>;
  draftId: Scalars['ID']['input'];
  nodeDescription?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
};

export type SiteSettings = {
  __typename?: 'SiteSettings';
  adsEnabled: Scalars['Boolean']['output'];
  adsensePublisherId?: Maybe<Scalars['String']['output']>;
  adsenseVerificationCode?: Maybe<Scalars['String']['output']>;
  footerAdSlot?: Maybe<Scalars['String']['output']>;
  googleOAuthEnabled: Scalars['Boolean']['output'];
  grantOGBadgeToSubscribers: Scalars['Boolean']['output'];
  homepageAdSlot?: Maybe<Scalars['String']['output']>;
  sentryDsn?: Maybe<Scalars['String']['output']>;
  sentryEnabled: Scalars['Boolean']['output'];
  showAdsInFooter: Scalars['Boolean']['output'];
  showAdsOnHomepage: Scalars['Boolean']['output'];
  showAdsOnStoryEnd: Scalars['Boolean']['output'];
  storyEndAdSlot?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
  updatedBy?: Maybe<Scalars['String']['output']>;
};

export type Story = {
  __typename?: 'Story';
  ageRating: AgeRating;
  aiCreated: Scalars['Boolean']['output'];
  allowAI: Scalars['Boolean']['output'];
  authorId: Scalars['String']['output'];
  authorName: Scalars['String']['output'];
  authorOGSupporter?: Maybe<Scalars['Boolean']['output']>;
  authorSubscriber?: Maybe<Scalars['Boolean']['output']>;
  authorSubscriptionTier?: Maybe<SubscriptionTier>;
  contentWarnings: Array<Scalars['String']['output']>;
  contributionPermission: ContributionPermission;
  coverImageTopUrl?: Maybe<Scalars['String']['output']>;
  coverImageUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  featured: Scalars['Boolean']['output'];
  genre: Array<Scalars['String']['output']>;
  ratingExplanation?: Maybe<Scalars['String']['output']>;
  rootNodeId?: Maybe<Scalars['String']['output']>;
  stats: StoryStats;
  storyId: Scalars['ID']['output'];
  synopsis: Scalars['String']['output'];
  title: Scalars['String']['output'];
  trending: Scalars['Boolean']['output'];
};

export type StoryConnection = {
  __typename?: 'StoryConnection';
  items: Array<Story>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type StoryFilter = {
  ageRating?: InputMaybe<AgeRating>;
  authorId?: InputMaybe<Scalars['ID']['input']>;
  featured?: InputMaybe<Scalars['Boolean']['input']>;
  genre?: InputMaybe<Scalars['String']['input']>;
  hideAIContent?: InputMaybe<Scalars['Boolean']['input']>;
  maxAgeRating?: InputMaybe<AgeRating>;
  minRating?: InputMaybe<Scalars['Float']['input']>;
  trending?: InputMaybe<Scalars['Boolean']['input']>;
};

export type StoryNode = {
  __typename?: 'StoryNode';
  ageRating?: Maybe<AgeRating>;
  aiCreated?: Maybe<Scalars['Boolean']['output']>;
  authorId: Scalars['String']['output'];
  authorName: Scalars['String']['output'];
  authorOGSupporter?: Maybe<Scalars['Boolean']['output']>;
  authorSubscriber?: Maybe<Scalars['Boolean']['output']>;
  authorSubscriptionTier?: Maybe<SubscriptionTier>;
  badges: NodeBadges;
  content: Scalars['String']['output'];
  contentWarnings?: Maybe<Array<Scalars['String']['output']>>;
  createdAt: Scalars['String']['output'];
  editableUntil: Scalars['String']['output'];
  maxChildAgeRating?: Maybe<AgeRating>;
  nodeDescription?: Maybe<Scalars['String']['output']>;
  nodeId: Scalars['ID']['output'];
  nodeNumber: Scalars['Int']['output'];
  parentNodeId?: Maybe<Scalars['ID']['output']>;
  stats: NodeStats;
  storyId: Scalars['ID']['output'];
};

export type StoryStats = {
  __typename?: 'StoryStats';
  rating?: Maybe<Scalars['Float']['output']>;
  ratingSum: Scalars['Int']['output'];
  totalComments: Scalars['Int']['output'];
  totalNodes: Scalars['Int']['output'];
  totalRatings: Scalars['Int']['output'];
  totalReads: Scalars['Int']['output'];
};

export type SubmitPeerReviewInput = {
  draftId: Scalars['ID']['input'];
  feedback: Scalars['String']['input'];
  rating?: InputMaybe<Scalars['Int']['input']>;
};

export type Subscription = {
  __typename?: 'Subscription';
  onNewNode?: Maybe<StoryNode>;
  onNewNotification?: Maybe<Notification>;
};


export type SubscriptionOnNewNodeArgs = {
  storyId: Scalars['ID']['input'];
};


export type SubscriptionOnNewNotificationArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionInfo = {
  __typename?: 'SubscriptionInfo';
  creatorUrl?: Maybe<Scalars['String']['output']>;
  lastSynced?: Maybe<Scalars['String']['output']>;
  periodEnd?: Maybe<Scalars['AWSDateTime']['output']>;
  status: SubscriptionStatus;
  stripeCustomerId?: Maybe<Scalars['String']['output']>;
  stripeSubscriptionId?: Maybe<Scalars['String']['output']>;
  tier: SubscriptionTier;
};

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
  INCOMPLETE = 'INCOMPLETE',
  NONE = 'NONE',
  PAST_DUE = 'PAST_DUE',
  TRIALING = 'TRIALING'
}

export enum SubscriptionTier {
  BRONZE = 'BRONZE',
  GOLD = 'GOLD',
  NONE = 'NONE',
  PLATINUM = 'PLATINUM',
  SILVER = 'SILVER'
}

export type SupportTicket = {
  __typename?: 'SupportTicket';
  assignedTo?: Maybe<Scalars['String']['output']>;
  category: TicketCategory;
  closedAt?: Maybe<Scalars['AWSDateTime']['output']>;
  createdAt: Scalars['AWSDateTime']['output'];
  description: Scalars['String']['output'];
  isPlatinumSupporter: Scalars['Boolean']['output'];
  priority: TicketPriority;
  resolvedAt?: Maybe<Scalars['AWSDateTime']['output']>;
  responses: Array<TicketResponse>;
  status: TicketStatus;
  subject: Scalars['String']['output'];
  ticketId: Scalars['ID']['output'];
  updatedAt: Scalars['AWSDateTime']['output'];
  userEmail: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
  userName: Scalars['String']['output'];
};

export type SupportTicketConnection = {
  __typename?: 'SupportTicketConnection';
  items: Array<SupportTicket>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type Supporter = {
  __typename?: 'Supporter';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  bio?: Maybe<Scalars['String']['output']>;
  creatorUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  ogSupporter: Scalars['Boolean']['output'];
  subscriptionTier?: Maybe<SubscriptionTier>;
  userId: Scalars['ID']['output'];
};

export type SupportersConnection = {
  __typename?: 'SupportersConnection';
  bronze: Array<Supporter>;
  gold: Array<Supporter>;
  ogSupporters: Array<Supporter>;
  platinum: Array<Supporter>;
  silver: Array<Supporter>;
};

export type TagSuggestion = {
  __typename?: 'TagSuggestion';
  name: Scalars['String']['output'];
  usageCount: Scalars['Int']['output'];
};

export enum TicketCategory {
  ACCOUNT_ISSUE = 'ACCOUNT_ISSUE',
  BILLING = 'BILLING',
  BUG_REPORT = 'BUG_REPORT',
  CONTENT_ISSUE = 'CONTENT_ISSUE',
  FEATURE_QUESTION = 'FEATURE_QUESTION',
  OTHER = 'OTHER'
}

export type TicketFilter = {
  category?: InputMaybe<TicketCategory>;
  priority?: InputMaybe<TicketPriority>;
  status?: InputMaybe<TicketStatus>;
};

export enum TicketPriority {
  NORMAL = 'NORMAL',
  PRIORITY = 'PRIORITY'
}

export type TicketResponse = {
  __typename?: 'TicketResponse';
  authorId: Scalars['String']['output'];
  authorName: Scalars['String']['output'];
  content: Scalars['String']['output'];
  createdAt: Scalars['AWSDateTime']['output'];
  isAdmin: Scalars['Boolean']['output'];
  responseId: Scalars['ID']['output'];
  ticketId: Scalars['ID']['output'];
};

export enum TicketSortBy {
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
  PRIORITY_FIRST = 'PRIORITY_FIRST',
  RECENTLY_UPDATED = 'RECENTLY_UPDATED'
}

export type TicketStats = {
  __typename?: 'TicketStats';
  priorityOpen: Scalars['Int']['output'];
  totalAwaitingUser: Scalars['Int']['output'];
  totalInProgress: Scalars['Int']['output'];
  totalOpen: Scalars['Int']['output'];
  totalResolved: Scalars['Int']['output'];
};

export enum TicketStatus {
  AWAITING_USER = 'AWAITING_USER',
  CLOSED = 'CLOSED',
  IN_PROGRESS = 'IN_PROGRESS',
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED'
}

export type TreeData = {
  __typename?: 'TreeData';
  rootNode: TreeNode;
  totalNodes: Scalars['Int']['output'];
};

export type TreeNode = {
  __typename?: 'TreeNode';
  authorId: Scalars['String']['output'];
  badges: NodeBadges;
  children: Array<TreeNode>;
  description?: Maybe<Scalars['String']['output']>;
  nodeId: Scalars['ID']['output'];
  stats: NodeStats;
  title: Scalars['String']['output'];
};

export type UpdateCommentInput = {
  commentId: Scalars['ID']['input'];
  content: Scalars['String']['input'];
  nodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
};

export type UpdateDraftInput = {
  ageRating?: InputMaybe<AgeRating>;
  content: Scalars['String']['input'];
  contentWarnings?: InputMaybe<Array<Scalars['String']['input']>>;
  draftId: Scalars['ID']['input'];
  nodeDescription?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateFeatureCommentInput = {
  commentId: Scalars['ID']['input'];
  content: Scalars['String']['input'];
  featureId: Scalars['ID']['input'];
};

export type UpdateFeatureRequestInput = {
  category?: InputMaybe<FeatureCategory>;
  description?: InputMaybe<Scalars['String']['input']>;
  featureId: Scalars['ID']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateFeatureStatusInput = {
  featureId: Scalars['ID']['input'];
  status: FeatureStatus;
};

export type UpdateNodeInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  nodeDescription?: InputMaybe<Scalars['String']['input']>;
  nodeId: Scalars['ID']['input'];
  storyId: Scalars['ID']['input'];
};

export type UpdateSiteSettingsInput = {
  adsEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  adsensePublisherId?: InputMaybe<Scalars['String']['input']>;
  adsenseVerificationCode?: InputMaybe<Scalars['String']['input']>;
  footerAdSlot?: InputMaybe<Scalars['String']['input']>;
  googleOAuthEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  grantOGBadgeToSubscribers?: InputMaybe<Scalars['Boolean']['input']>;
  homepageAdSlot?: InputMaybe<Scalars['String']['input']>;
  sentryDsn?: InputMaybe<Scalars['String']['input']>;
  sentryEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  showAdsInFooter?: InputMaybe<Scalars['Boolean']['input']>;
  showAdsOnHomepage?: InputMaybe<Scalars['Boolean']['input']>;
  showAdsOnStoryEnd?: InputMaybe<Scalars['Boolean']['input']>;
  storyEndAdSlot?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateStoryInput = {
  ageRating?: InputMaybe<AgeRating>;
  allowAI?: InputMaybe<Scalars['Boolean']['input']>;
  contentWarnings?: InputMaybe<Array<Scalars['String']['input']>>;
  contributionPermission?: InputMaybe<ContributionPermission>;
  coverImageTopUrl?: InputMaybe<Scalars['String']['input']>;
  coverImageUrl?: InputMaybe<Scalars['String']['input']>;
  featured?: InputMaybe<Scalars['Boolean']['input']>;
  genre?: InputMaybe<Array<Scalars['String']['input']>>;
  storyId: Scalars['ID']['input'];
  synopsis?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  trending?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateTicketStatusInput = {
  status: TicketStatus;
  ticketId: Scalars['ID']['input'];
};

export type UpdateUserContentSettingsInput = {
  autoSaveEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  defaultAgeRatingFilter?: InputMaybe<AgeRating>;
  hideAIContent?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateUserNotificationSettingsInput = {
  emailNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  notificationFrequency?: InputMaybe<NotificationFrequency>;
  notifyOnReply?: InputMaybe<Scalars['Boolean']['input']>;
  notifyOnStoryUpdate?: InputMaybe<Scalars['Boolean']['input']>;
  notifyOnUpvote?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateUserPrivacySettingsInput = {
  profileVisibility?: InputMaybe<ProfileVisibility>;
  showOnSupportersPage?: InputMaybe<Scalars['Boolean']['input']>;
  showStats?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateUserProfileInput = {
  avatarUrl?: InputMaybe<Scalars['String']['input']>;
  bio?: InputMaybe<Scalars['String']['input']>;
  creatorUrl?: InputMaybe<Scalars['String']['input']>;
  favoriteAuthors?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  favoriteContributors?: InputMaybe<Array<InputMaybe<ContributorInput>>>;
  interests?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type UpdateUserSettingsInput = {
  contentSettings?: InputMaybe<UpdateUserContentSettingsInput>;
  notificationSettings?: InputMaybe<UpdateUserNotificationSettingsInput>;
  privacySettings?: InputMaybe<UpdateUserPrivacySettingsInput>;
};

export enum UploadType {
  AVATAR = 'AVATAR',
  COVER_ART = 'COVER_ART'
}

export type UploadUrl = {
  __typename?: 'UploadUrl';
  fileUrl: Scalars['String']['output'];
  key: Scalars['String']['output'];
  uploadUrl: Scalars['String']['output'];
};

export type User = {
  __typename?: 'User';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  bio?: Maybe<Scalars['String']['output']>;
  contentSettings?: Maybe<UserContentSettings>;
  createdAt: Scalars['String']['output'];
  email: Scalars['String']['output'];
  favoriteAuthors?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  favoriteContributors?: Maybe<Array<Maybe<Contributor>>>;
  interests?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  notificationSettings?: Maybe<UserNotificationSettings>;
  ogSupporter: Scalars['Boolean']['output'];
  privacySettings?: Maybe<UserPrivacySettings>;
  stats: UserStats;
  subscriber: Scalars['Boolean']['output'];
  subscriptionInfo?: Maybe<SubscriptionInfo>;
  userId: Scalars['ID']['output'];
  username: Scalars['String']['output'];
};

export type UserContentSettings = {
  __typename?: 'UserContentSettings';
  autoSaveEnabled: Scalars['Boolean']['output'];
  defaultAgeRatingFilter: AgeRating;
  hideAIContent: Scalars['Boolean']['output'];
};

export type UserContribution = {
  __typename?: 'UserContribution';
  createdAt: Scalars['String']['output'];
  downvotes: Scalars['Int']['output'];
  nodeDescription?: Maybe<Scalars['String']['output']>;
  nodeId: Scalars['ID']['output'];
  nodeNumber: Scalars['Int']['output'];
  storyId: Scalars['ID']['output'];
  storyTitle: Scalars['String']['output'];
  upvotes: Scalars['Int']['output'];
};

export type UserContributionsConnection = {
  __typename?: 'UserContributionsConnection';
  items: Array<UserContribution>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type UserListItem = {
  __typename?: 'UserListItem';
  createdAt: Scalars['String']['output'];
  email: Scalars['String']['output'];
  ogSupporter: Scalars['Boolean']['output'];
  subscriber: Scalars['Boolean']['output'];
  subscriptionInfo?: Maybe<SubscriptionInfo>;
  userId: Scalars['ID']['output'];
  username: Scalars['String']['output'];
};

export type UserListResponse = {
  __typename?: 'UserListResponse';
  count: Scalars['Int']['output'];
  users: Array<UserListItem>;
};

export type UserNotificationSettings = {
  __typename?: 'UserNotificationSettings';
  emailNotifications: Scalars['Boolean']['output'];
  notificationFrequency: NotificationFrequency;
  notifyOnReply: Scalars['Boolean']['output'];
  notifyOnStoryUpdate: Scalars['Boolean']['output'];
  notifyOnUpvote: Scalars['Boolean']['output'];
};

export type UserPrivacySettings = {
  __typename?: 'UserPrivacySettings';
  profileVisibility: ProfileVisibility;
  showOnSupportersPage: Scalars['Boolean']['output'];
  showStats: Scalars['Boolean']['output'];
};

export type UserStats = {
  __typename?: 'UserStats';
  nodesContributed?: Maybe<Scalars['Int']['output']>;
  storiesCreated: Scalars['Int']['output'];
  totalUpvotes?: Maybe<Scalars['Int']['output']>;
};

export type UserSummary = {
  __typename?: 'UserSummary';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type UserVoteSummary = {
  __typename?: 'UserVoteSummary';
  maxVotes: Scalars['Int']['output'];
  totalVotesUsed: Scalars['Int']['output'];
  userId: Scalars['ID']['output'];
  votes: Array<FeatureVote>;
  votesRemaining: Scalars['Int']['output'];
};

export type UsernameAvailability = {
  __typename?: 'UsernameAvailability';
  available: Scalars['Boolean']['output'];
  username: Scalars['String']['output'];
};

export type UsersByTagConnection = {
  __typename?: 'UsersByTagConnection';
  items: Array<UserSummary>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type VoteOnFeatureInput = {
  featureId: Scalars['ID']['input'];
};

export enum VoteType {
  DOWNVOTE = 'DOWNVOTE',
  REMOVE_VOTE = 'REMOVE_VOTE',
  UPVOTE = 'UPVOTE'
}

export type ListBookmarksQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListBookmarksQuery = { __typename?: 'Query', listBookmarks?: { __typename: 'BookmarkConnection', nextToken?: string | null, items: Array<{ __typename: 'BookmarkWithStory', userId: string, storyId: string, storyTitle: string, storyGenre?: string | null, storyCoverImage?: string | null, currentNodeId: string, breadcrumbs: Array<string>, lastRead: string }> } | null };

export type DraftNodeFieldsFragment = { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string };

export type DraftVersionFieldsFragment = { __typename?: 'DraftVersion', versionNumber: number, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, note?: string | null, createdAt: string };

export type ClipboardItemFieldsFragment = { __typename?: 'ClipboardItem', clipId: string, content: string, reason?: string | null, clippedAt: string };

export type PeerReviewFieldsFragment = { __typename?: 'PeerReview', reviewerId: string, reviewerName: string, feedback?: string | null, rating?: number | null, createdAt: string };

export type GetDraftQueryVariables = Exact<{
  draftId: Scalars['ID']['input'];
}>;


export type GetDraftQuery = { __typename?: 'Query', getDraft?: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string, versions: Array<{ __typename?: 'DraftVersion', versionNumber: number, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, note?: string | null, createdAt: string }>, clipboardItems: Array<{ __typename?: 'ClipboardItem', clipId: string, content: string, reason?: string | null, clippedAt: string }>, peerReviews: Array<{ __typename?: 'PeerReview', reviewerId: string, reviewerName: string, feedback?: string | null, rating?: number | null, createdAt: string }> } | null };

export type ListMyDraftsQueryVariables = Exact<{
  storyId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<DraftStatus>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListMyDraftsQuery = { __typename?: 'Query', listMyDrafts: { __typename?: 'DraftConnection', nextToken?: string | null, items: Array<{ __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string }> } };

export type ListDraftsPendingReviewQueryVariables = Exact<{
  storyId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListDraftsPendingReviewQuery = { __typename?: 'Query', listDraftsPendingReview: { __typename?: 'DraftConnection', nextToken?: string | null, items: Array<{ __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string }> } };

export type CreateDraftMutationVariables = Exact<{
  input: CreateDraftInput;
}>;


export type CreateDraftMutation = { __typename?: 'Mutation', createDraft: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string } };

export type UpdateDraftMutationVariables = Exact<{
  input: UpdateDraftInput;
}>;


export type UpdateDraftMutation = { __typename?: 'Mutation', updateDraft: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string } };

export type DeleteDraftMutationVariables = Exact<{
  draftId: Scalars['ID']['input'];
}>;


export type DeleteDraftMutation = { __typename?: 'Mutation', deleteDraft: boolean };

export type SaveDraftVersionMutationVariables = Exact<{
  input: SaveDraftVersionInput;
}>;


export type SaveDraftVersionMutation = { __typename?: 'Mutation', saveDraftVersion: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string, versions: Array<{ __typename?: 'DraftVersion', versionNumber: number, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, note?: string | null, createdAt: string }> } };

export type ClipContentMutationVariables = Exact<{
  input: ClipContentInput;
}>;


export type ClipContentMutation = { __typename?: 'Mutation', clipContent: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string, clipboardItems: Array<{ __typename?: 'ClipboardItem', clipId: string, content: string, reason?: string | null, clippedAt: string }> } };

export type RestoreClipMutationVariables = Exact<{
  draftId: Scalars['ID']['input'];
  clipId: Scalars['ID']['input'];
}>;


export type RestoreClipMutation = { __typename?: 'Mutation', restoreClip: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string, clipboardItems: Array<{ __typename?: 'ClipboardItem', clipId: string, content: string, reason?: string | null, clippedAt: string }> } };

export type DeleteClipMutationVariables = Exact<{
  draftId: Scalars['ID']['input'];
  clipId: Scalars['ID']['input'];
}>;


export type DeleteClipMutation = { __typename?: 'Mutation', deleteClip: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string, clipboardItems: Array<{ __typename?: 'ClipboardItem', clipId: string, content: string, reason?: string | null, clippedAt: string }> } };

export type SubmitDraftForReviewMutationVariables = Exact<{
  draftId: Scalars['ID']['input'];
}>;


export type SubmitDraftForReviewMutation = { __typename?: 'Mutation', submitDraftForReview: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string } };

export type ApproveDraftMutationVariables = Exact<{
  draftId: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
}>;


export type ApproveDraftMutation = { __typename?: 'Mutation', approveDraft: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string } };

export type RejectDraftMutationVariables = Exact<{
  draftId: Scalars['ID']['input'];
  notes: Scalars['String']['input'];
}>;


export type RejectDraftMutation = { __typename?: 'Mutation', rejectDraft: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string } };

export type RequestDraftRevisionMutationVariables = Exact<{
  draftId: Scalars['ID']['input'];
  notes: Scalars['String']['input'];
}>;


export type RequestDraftRevisionMutation = { __typename?: 'Mutation', requestDraftRevision: { __typename?: 'DraftNode', draftId: string, storyId: string, parentNodeId: string, authorId: string, authorName: string, content: string, nodeDescription?: string | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, currentVersionNumber: number, status: DraftStatus, approvalStatus?: ApprovalStatus | null, reviewerId?: string | null, reviewerNotes?: string | null, reviewedAt?: string | null, createdAt: string, updatedAt: string } };

export type AbandonDraftMutationVariables = Exact<{
  draftId: Scalars['ID']['input'];
}>;


export type AbandonDraftMutation = { __typename?: 'Mutation', abandonDraft: boolean };

export type PublishDraftMutationVariables = Exact<{
  draftId: Scalars['ID']['input'];
}>;


export type PublishDraftMutation = { __typename?: 'Mutation', publishDraft: { __typename?: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, content: string, nodeDescription?: string | null, authorId: string, authorName: string, createdAt: string } };

export type ListFeaturesQueryVariables = Exact<{
  filter?: InputMaybe<FeatureFilter>;
  sortBy?: InputMaybe<FeatureSortBy>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListFeaturesQuery = { __typename?: 'Query', listFeatures?: { __typename?: 'FeatureConnection', nextToken?: string | null, items: Array<{ __typename: 'FeatureRequest', featureId: string, title: string, description: string, category: FeatureCategory, status: FeatureStatus, voteCount: number, commentCount: number, submittedBy: string, submittedByName: string, createdAt: any, updatedAt: any }> } | null };

export type GetFeatureQueryVariables = Exact<{
  featureId: Scalars['ID']['input'];
}>;


export type GetFeatureQuery = { __typename?: 'Query', getFeature?: { __typename: 'FeatureRequest', featureId: string, title: string, description: string, category: FeatureCategory, status: FeatureStatus, voteCount: number, commentCount: number, submittedBy: string, submittedByName: string, createdAt: any, updatedAt: any } | null };

export type GetUserVoteSummaryQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserVoteSummaryQuery = { __typename?: 'Query', getUserVoteSummary?: { __typename: 'UserVoteSummary', userId: string, totalVotesUsed: number, maxVotes: number, votesRemaining: number, votes: Array<{ __typename: 'FeatureVote', userId: string, featureId: string, createdAt: any }> } | null };

export type ListFeatureCommentsQueryVariables = Exact<{
  featureId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListFeatureCommentsQuery = { __typename?: 'Query', listFeatureComments?: { __typename?: 'FeatureCommentConnection', nextToken?: string | null, items: Array<{ __typename: 'FeatureComment', commentId: string, featureId: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, createdAt: any, updatedAt?: any | null, edited?: boolean | null }> } | null };

export type ListPendingFeaturesQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListPendingFeaturesQuery = { __typename?: 'Query', listPendingFeatures?: { __typename?: 'FeatureConnection', nextToken?: string | null, items: Array<{ __typename: 'FeatureRequest', featureId: string, title: string, description: string, category: FeatureCategory, status: FeatureStatus, voteCount: number, commentCount: number, submittedBy: string, submittedByName: string, createdAt: any, updatedAt: any }> } | null };

export type CreateFeatureRequestMutationVariables = Exact<{
  input: CreateFeatureRequestInput;
}>;


export type CreateFeatureRequestMutation = { __typename?: 'Mutation', createFeatureRequest?: { __typename: 'FeatureRequest', featureId: string, title: string, description: string, category: FeatureCategory, status: FeatureStatus, voteCount: number, commentCount: number, submittedBy: string, submittedByName: string, createdAt: any, updatedAt: any } | null };

export type UpdateFeatureRequestMutationVariables = Exact<{
  input: UpdateFeatureRequestInput;
}>;


export type UpdateFeatureRequestMutation = { __typename?: 'Mutation', updateFeatureRequest?: { __typename: 'FeatureRequest', featureId: string, title: string, description: string, category: FeatureCategory, status: FeatureStatus, voteCount: number, commentCount: number, submittedBy: string, submittedByName: string, createdAt: any, updatedAt: any } | null };

export type DeleteFeatureRequestMutationVariables = Exact<{
  featureId: Scalars['ID']['input'];
}>;


export type DeleteFeatureRequestMutation = { __typename?: 'Mutation', deleteFeatureRequest?: boolean | null };

export type VoteOnFeatureMutationVariables = Exact<{
  input: VoteOnFeatureInput;
}>;


export type VoteOnFeatureMutation = { __typename?: 'Mutation', voteOnFeature?: { __typename: 'UserVoteSummary', userId: string, totalVotesUsed: number, maxVotes: number, votesRemaining: number, votes: Array<{ __typename: 'FeatureVote', userId: string, featureId: string, createdAt: any }> } | null };

export type RemoveVoteFromFeatureMutationVariables = Exact<{
  input: RemoveVoteInput;
}>;


export type RemoveVoteFromFeatureMutation = { __typename?: 'Mutation', removeVoteFromFeature?: { __typename: 'UserVoteSummary', userId: string, totalVotesUsed: number, maxVotes: number, votesRemaining: number, votes: Array<{ __typename: 'FeatureVote', userId: string, featureId: string, createdAt: any }> } | null };

export type ApproveFeatureRequestMutationVariables = Exact<{
  input: ApproveFeatureRequestInput;
}>;


export type ApproveFeatureRequestMutation = { __typename?: 'Mutation', approveFeatureRequest?: { __typename: 'FeatureRequest', featureId: string, title: string, description: string, category: FeatureCategory, status: FeatureStatus, voteCount: number, commentCount: number, submittedBy: string, submittedByName: string, createdAt: any, updatedAt: any } | null };

export type RejectFeatureRequestMutationVariables = Exact<{
  input: RejectFeatureRequestInput;
}>;


export type RejectFeatureRequestMutation = { __typename?: 'Mutation', rejectFeatureRequest?: { __typename: 'FeatureRequest', featureId: string, title: string, description: string, category: FeatureCategory, status: FeatureStatus, voteCount: number, commentCount: number, submittedBy: string, submittedByName: string, createdAt: any, updatedAt: any } | null };

export type CreateFeatureCommentMutationVariables = Exact<{
  input: CreateFeatureCommentInput;
}>;


export type CreateFeatureCommentMutation = { __typename?: 'Mutation', createFeatureComment?: { __typename: 'FeatureComment', commentId: string, featureId: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, createdAt: any, updatedAt?: any | null, edited?: boolean | null } | null };

export type UpdateFeatureCommentMutationVariables = Exact<{
  input: UpdateFeatureCommentInput;
}>;


export type UpdateFeatureCommentMutation = { __typename?: 'Mutation', updateFeatureComment?: { __typename: 'FeatureComment', commentId: string, featureId: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, createdAt: any, updatedAt?: any | null, edited?: boolean | null } | null };

export type DeleteFeatureCommentMutationVariables = Exact<{
  input: DeleteFeatureCommentInput;
}>;


export type DeleteFeatureCommentMutation = { __typename?: 'Mutation', deleteFeatureComment?: boolean | null };

export type StoryCardFieldsFragment = { __typename: 'Story', storyId: string, title: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, synopsis: string, genre: Array<string>, ageRating: AgeRating, coverImageUrl?: string | null, coverImageTopUrl?: string | null, featured: boolean, aiCreated: boolean, createdAt: string, stats: { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null } };

export type StoryWithAuthorBadgesFragment = { __typename: 'Story', storyId: string, title: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, synopsis: string, genre: Array<string>, ageRating: AgeRating, coverImageUrl?: string | null, coverImageTopUrl?: string | null, featured: boolean, aiCreated: boolean, createdAt: string, stats: { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null } };

export type StoryFullFieldsFragment = { __typename: 'Story', storyId: string, title: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, synopsis: string, genre: Array<string>, ageRating: AgeRating, contentWarnings: Array<string>, ratingExplanation?: string | null, coverImageUrl?: string | null, coverImageTopUrl?: string | null, rootNodeId?: string | null, featured: boolean, aiCreated: boolean, allowAI: boolean, createdAt: string, stats: { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null, ratingSum: number, totalRatings: number } };

export type StoryNodeCardFieldsFragment = { __typename: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, authorId: string, authorName: string, content: string, nodeDescription?: string | null, nodeNumber: number, aiCreated?: boolean | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, createdAt: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number } };

export type StoryNodeWithAuthorBadgesFragment = { __typename: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, nodeDescription?: string | null, nodeNumber: number, aiCreated?: boolean | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, createdAt: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number } };

export type StoryNodeFullFieldsFragment = { __typename: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, nodeDescription?: string | null, nodeNumber: number, aiCreated?: boolean | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, maxChildAgeRating?: AgeRating | null, createdAt: string, editableUntil: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean } };

export type CommentBasicFieldsFragment = { __typename: 'Comment', commentId: string, storyId: string, nodeId: string, authorId: string, authorName: string, content: string, createdAt: any, updatedAt: any, edited?: boolean | null };

export type CommentWithAuthorBadgesFragment = { __typename: 'Comment', commentId: string, storyId: string, nodeId: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, createdAt: any, updatedAt: any, edited?: boolean | null };

export type UserBasicFieldsFragment = { __typename: 'User', userId: string, username: string, createdAt: string };

export type UserWithBadgesFragment = { __typename: 'User', userId: string, username: string, subscriber: boolean, ogSupporter: boolean, createdAt: string };

export type UserProfileFieldsFragment = { __typename: 'User', userId: string, username: string, email: string, bio?: string | null, subscriber: boolean, ogSupporter: boolean, createdAt: string, subscriptionInfo?: { __typename: 'SubscriptionInfo', tier: SubscriptionTier } | null };

export type StoryStatsBasicFragment = { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null };

export type StoryStatsFullFragment = { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null, ratingSum: number, totalRatings: number };

export type NodeStatsFragment = { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number };

export type NodeBadgesFragment = { __typename: 'NodeBadges', authorApproved: boolean };

export type FeatureRequestBasicFragment = { __typename: 'FeatureRequest', featureId: string, title: string, description: string, category: FeatureCategory, status: FeatureStatus, voteCount: number, commentCount: number, submittedBy: string, submittedByName: string, createdAt: any, updatedAt: any };

export type FeatureCommentFieldsFragment = { __typename: 'FeatureComment', commentId: string, featureId: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, createdAt: any, updatedAt?: any | null, edited?: boolean | null };

export type UserVoteSummaryFragment = { __typename: 'UserVoteSummary', userId: string, totalVotesUsed: number, maxVotes: number, votesRemaining: number, votes: Array<{ __typename: 'FeatureVote', userId: string, featureId: string, createdAt: any }> };

export type StartImpersonationMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
  mfaCode?: InputMaybe<Scalars['String']['input']>;
}>;


export type StartImpersonationMutation = { __typename?: 'Mutation', startImpersonation: { __typename?: 'ImpersonationSession', sessionId: string, adminUserId: string, impersonatedUserId: string, impersonatedUsername: string, impersonatedEmail: string, subscriber: boolean, ogSupporter: boolean, startedAt: string, expiresAt: string } };

export type StopImpersonationMutationVariables = Exact<{ [key: string]: never; }>;


export type StopImpersonationMutation = { __typename?: 'Mutation', stopImpersonation: boolean };

export type GetImpersonationStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type GetImpersonationStatusQuery = { __typename?: 'Query', getImpersonationStatus: { __typename?: 'ImpersonationStatus', isImpersonating: boolean, session?: { __typename?: 'ImpersonationSession', sessionId: string, adminUserId: string, impersonatedUserId: string, impersonatedUsername: string, impersonatedEmail: string, subscriber: boolean, ogSupporter: boolean, startedAt: string, expiresAt: string } | null } };

export type GetNodeQueryVariables = Exact<{
  storyId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
}>;


export type GetNodeQuery = { __typename?: 'Query', getNode?: { __typename: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, nodeDescription?: string | null, nodeNumber: number, aiCreated?: boolean | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, maxChildAgeRating?: AgeRating | null, createdAt: string, editableUntil: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean } } | null };

export type ListChildNodesQueryVariables = Exact<{
  storyId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
}>;


export type ListChildNodesQuery = { __typename?: 'Query', listChildNodes: Array<{ __typename: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, nodeDescription?: string | null, nodeNumber: number, aiCreated?: boolean | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, maxChildAgeRating?: AgeRating | null, createdAt: string, editableUntil: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean } }> };

export type GetReadingPathQueryVariables = Exact<{
  storyId: Scalars['ID']['input'];
  nodePath: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
}>;


export type GetReadingPathQuery = { __typename?: 'Query', getReadingPath: Array<{ __typename: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, nodeDescription?: string | null, nodeNumber: number, aiCreated?: boolean | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, maxChildAgeRating?: AgeRating | null, createdAt: string, editableUntil: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean } }> };

export type CreateNodeMutationVariables = Exact<{
  input: CreateNodeInput;
}>;


export type CreateNodeMutation = { __typename?: 'Mutation', createNode?: { __typename: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, nodeDescription?: string | null, nodeNumber: number, aiCreated?: boolean | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, maxChildAgeRating?: AgeRating | null, createdAt: string, editableUntil: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean } } | null };

export type UpdateNodeMutationVariables = Exact<{
  input: UpdateNodeInput;
}>;


export type UpdateNodeMutation = { __typename?: 'Mutation', updateNode?: { __typename: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, nodeDescription?: string | null, nodeNumber: number, aiCreated?: boolean | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, maxChildAgeRating?: AgeRating | null, createdAt: string, editableUntil: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean } } | null };

export type VoteOnNodeMutationVariables = Exact<{
  storyId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
  voteType: VoteType;
}>;


export type VoteOnNodeMutation = { __typename?: 'Mutation', voteOnNode?: { __typename: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, nodeDescription?: string | null, nodeNumber: number, aiCreated?: boolean | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, maxChildAgeRating?: AgeRating | null, createdAt: string, editableUntil: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean } } | null };

export type AwardBadgeMutationVariables = Exact<{
  input: AwardBadgeInput;
}>;


export type AwardBadgeMutation = { __typename?: 'Mutation', awardBadge?: { __typename: 'StoryNode', nodeId: string, storyId: string, parentNodeId?: string | null, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, content: string, nodeDescription?: string | null, nodeNumber: number, aiCreated?: boolean | null, ageRating?: AgeRating | null, contentWarnings?: Array<string> | null, maxChildAgeRating?: AgeRating | null, createdAt: string, editableUntil: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean } } | null };

export type GetSiteSettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetSiteSettingsQuery = { __typename?: 'Query', getSiteSettings: { __typename?: 'SiteSettings', grantOGBadgeToSubscribers: boolean, googleOAuthEnabled: boolean, adsEnabled: boolean, adsensePublisherId?: string | null, adsenseVerificationCode?: string | null, showAdsOnHomepage: boolean, showAdsOnStoryEnd: boolean, showAdsInFooter: boolean, homepageAdSlot?: string | null, storyEndAdSlot?: string | null, footerAdSlot?: string | null, sentryDsn?: string | null, sentryEnabled: boolean, updatedAt: string, updatedBy?: string | null } };

export type UpdateSiteSettingsMutationVariables = Exact<{
  input: UpdateSiteSettingsInput;
  mfaCode?: InputMaybe<Scalars['String']['input']>;
}>;


export type UpdateSiteSettingsMutation = { __typename?: 'Mutation', updateSiteSettings: { __typename?: 'SiteSettings', grantOGBadgeToSubscribers: boolean, googleOAuthEnabled: boolean, adsEnabled: boolean, adsensePublisherId?: string | null, adsenseVerificationCode?: string | null, showAdsOnHomepage: boolean, showAdsOnStoryEnd: boolean, showAdsInFooter: boolean, homepageAdSlot?: string | null, storyEndAdSlot?: string | null, footerAdSlot?: string | null, sentryDsn?: string | null, sentryEnabled: boolean, updatedAt: string, updatedBy?: string | null } };

export type GetStoryQueryVariables = Exact<{
  storyId: Scalars['ID']['input'];
}>;


export type GetStoryQuery = { __typename?: 'Query', getStory?: { __typename: 'Story', storyId: string, title: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, synopsis: string, genre: Array<string>, ageRating: AgeRating, contentWarnings: Array<string>, ratingExplanation?: string | null, coverImageUrl?: string | null, coverImageTopUrl?: string | null, rootNodeId?: string | null, featured: boolean, aiCreated: boolean, allowAI: boolean, createdAt: string, stats: { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null, ratingSum: number, totalRatings: number } } | null };

export type ListStoriesQueryVariables = Exact<{
  filter?: InputMaybe<StoryFilter>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListStoriesQuery = { __typename?: 'Query', listStories?: { __typename: 'StoryConnection', nextToken?: string | null, items: Array<{ __typename: 'Story', storyId: string, title: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, synopsis: string, genre: Array<string>, ageRating: AgeRating, contentWarnings: Array<string>, ratingExplanation?: string | null, coverImageUrl?: string | null, coverImageTopUrl?: string | null, rootNodeId?: string | null, featured: boolean, aiCreated: boolean, allowAI: boolean, createdAt: string, stats: { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null, ratingSum: number, totalRatings: number } }> } | null };

export type ListStoriesForBrowseQueryVariables = Exact<{
  filter?: InputMaybe<StoryFilter>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListStoriesForBrowseQuery = { __typename?: 'Query', listStories?: { __typename: 'StoryConnection', nextToken?: string | null, items: Array<{ __typename: 'Story', storyId: string, title: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, synopsis: string, genre: Array<string>, ageRating: AgeRating, coverImageUrl?: string | null, coverImageTopUrl?: string | null, featured: boolean, aiCreated: boolean, createdAt: string, stats: { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null } }> } | null };

export type GetStoryTreeQueryVariables = Exact<{
  storyId: Scalars['ID']['input'];
}>;


export type GetStoryTreeQuery = { __typename?: 'Query', getStoryTree?: { __typename: 'TreeData', totalNodes: number, rootNode: { __typename: 'TreeNode', nodeId: string, title: string, description?: string | null, authorId: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean }, children: Array<{ __typename: 'TreeNode', nodeId: string, title: string, description?: string | null, authorId: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean }, children: Array<{ __typename: 'TreeNode', nodeId: string, title: string, description?: string | null, authorId: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean }, children: Array<{ __typename: 'TreeNode', nodeId: string, title: string, description?: string | null, authorId: string, stats: { __typename: 'NodeStats', reads: number, upvotes: number, downvotes: number, childNodes: number }, badges: { __typename: 'NodeBadges', authorApproved: boolean } }> }> }> } } | null };

export type CreateStoryMutationVariables = Exact<{
  input: CreateStoryInput;
}>;


export type CreateStoryMutation = { __typename?: 'Mutation', createStory?: { __typename: 'Story', storyId: string, title: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, synopsis: string, genre: Array<string>, ageRating: AgeRating, contentWarnings: Array<string>, ratingExplanation?: string | null, coverImageUrl?: string | null, coverImageTopUrl?: string | null, rootNodeId?: string | null, featured: boolean, aiCreated: boolean, allowAI: boolean, createdAt: string, stats: { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null, ratingSum: number, totalRatings: number } } | null };

export type UpdateStoryMutationVariables = Exact<{
  input: UpdateStoryInput;
}>;


export type UpdateStoryMutation = { __typename?: 'Mutation', updateStory?: { __typename: 'Story', storyId: string, title: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, synopsis: string, genre: Array<string>, ageRating: AgeRating, contentWarnings: Array<string>, ratingExplanation?: string | null, coverImageUrl?: string | null, coverImageTopUrl?: string | null, rootNodeId?: string | null, featured: boolean, aiCreated: boolean, allowAI: boolean, createdAt: string, stats: { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null, ratingSum: number, totalRatings: number } } | null };

export type RateStoryMutationVariables = Exact<{
  storyId: Scalars['ID']['input'];
  rating: Scalars['Int']['input'];
}>;


export type RateStoryMutation = { __typename?: 'Mutation', rateStory?: { __typename: 'Story', storyId: string, title: string, authorId: string, authorName: string, authorSubscriber?: boolean | null, authorSubscriptionTier?: SubscriptionTier | null, authorOGSupporter?: boolean | null, synopsis: string, genre: Array<string>, ageRating: AgeRating, contentWarnings: Array<string>, ratingExplanation?: string | null, coverImageUrl?: string | null, coverImageTopUrl?: string | null, rootNodeId?: string | null, featured: boolean, aiCreated: boolean, allowAI: boolean, createdAt: string, stats: { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null, ratingSum: number, totalRatings: number } } | null };

export type IncrementStoryReadsMutationVariables = Exact<{
  storyId: Scalars['ID']['input'];
}>;


export type IncrementStoryReadsMutation = { __typename?: 'Mutation', incrementStoryReads?: { __typename: 'StoryStats', totalNodes: number, totalReads: number, totalComments: number, rating?: number | null, ratingSum: number, totalRatings: number } | null };

export type GetSupportTicketQueryVariables = Exact<{
  ticketId: Scalars['ID']['input'];
}>;


export type GetSupportTicketQuery = { __typename?: 'Query', getSupportTicket?: { __typename: 'SupportTicket', ticketId: string, userId: string, userEmail: string, userName: string, isPlatinumSupporter: boolean, subject: string, description: string, category: TicketCategory, status: TicketStatus, priority: TicketPriority, createdAt: any, updatedAt: any, resolvedAt?: any | null, closedAt?: any | null, assignedTo?: string | null, responses: Array<{ __typename?: 'TicketResponse', responseId: string, ticketId: string, authorId: string, authorName: string, isAdmin: boolean, content: string, createdAt: any }> } | null };

export type ListMyTicketsQueryVariables = Exact<{
  filter?: InputMaybe<TicketFilter>;
  sortBy?: InputMaybe<TicketSortBy>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListMyTicketsQuery = { __typename?: 'Query', listMyTickets?: { __typename: 'SupportTicketConnection', nextToken?: string | null, items: Array<{ __typename: 'SupportTicket', ticketId: string, userId: string, userEmail: string, userName: string, isPlatinumSupporter: boolean, subject: string, description: string, category: TicketCategory, status: TicketStatus, priority: TicketPriority, createdAt: any, updatedAt: any, resolvedAt?: any | null, closedAt?: any | null, assignedTo?: string | null, responses: Array<{ __typename?: 'TicketResponse', responseId: string, ticketId: string, authorId: string, authorName: string, isAdmin: boolean, content: string, createdAt: any }> }> } | null };

export type ListAllTicketsQueryVariables = Exact<{
  filter?: InputMaybe<TicketFilter>;
  sortBy?: InputMaybe<TicketSortBy>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListAllTicketsQuery = { __typename?: 'Query', listAllTickets?: { __typename: 'SupportTicketConnection', nextToken?: string | null, items: Array<{ __typename: 'SupportTicket', ticketId: string, userId: string, userEmail: string, userName: string, isPlatinumSupporter: boolean, subject: string, description: string, category: TicketCategory, status: TicketStatus, priority: TicketPriority, createdAt: any, updatedAt: any, resolvedAt?: any | null, closedAt?: any | null, assignedTo?: string | null, responses: Array<{ __typename?: 'TicketResponse', responseId: string, ticketId: string, authorId: string, authorName: string, isAdmin: boolean, content: string, createdAt: any }> }> } | null };

export type GetTicketStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTicketStatsQuery = { __typename?: 'Query', getTicketStats?: { __typename: 'TicketStats', totalOpen: number, totalInProgress: number, totalAwaitingUser: number, totalResolved: number, priorityOpen: number } | null };

export type CreateSupportTicketMutationVariables = Exact<{
  input: CreateSupportTicketInput;
}>;


export type CreateSupportTicketMutation = { __typename?: 'Mutation', createSupportTicket?: { __typename: 'SupportTicket', ticketId: string, userId: string, userEmail: string, userName: string, isPlatinumSupporter: boolean, subject: string, description: string, category: TicketCategory, status: TicketStatus, priority: TicketPriority, createdAt: any, updatedAt: any, responses: Array<{ __typename?: 'TicketResponse', responseId: string, ticketId: string, authorId: string, authorName: string, isAdmin: boolean, content: string, createdAt: any }> } | null };

export type AddTicketResponseMutationVariables = Exact<{
  input: AddTicketResponseInput;
}>;


export type AddTicketResponseMutation = { __typename?: 'Mutation', addTicketResponse?: { __typename: 'SupportTicket', ticketId: string, userId: string, userEmail: string, userName: string, isPlatinumSupporter: boolean, subject: string, description: string, category: TicketCategory, status: TicketStatus, priority: TicketPriority, createdAt: any, updatedAt: any, resolvedAt?: any | null, closedAt?: any | null, assignedTo?: string | null, responses: Array<{ __typename?: 'TicketResponse', responseId: string, ticketId: string, authorId: string, authorName: string, isAdmin: boolean, content: string, createdAt: any }> } | null };

export type UpdateTicketStatusMutationVariables = Exact<{
  input: UpdateTicketStatusInput;
}>;


export type UpdateTicketStatusMutation = { __typename?: 'Mutation', updateTicketStatus?: { __typename: 'SupportTicket', ticketId: string, userId: string, userEmail: string, userName: string, isPlatinumSupporter: boolean, subject: string, description: string, category: TicketCategory, status: TicketStatus, priority: TicketPriority, createdAt: any, updatedAt: any, resolvedAt?: any | null, closedAt?: any | null, assignedTo?: string | null, responses: Array<{ __typename?: 'TicketResponse', responseId: string, ticketId: string, authorId: string, authorName: string, isAdmin: boolean, content: string, createdAt: any }> } | null };

export type AssignTicketMutationVariables = Exact<{
  input: AssignTicketInput;
}>;


export type AssignTicketMutation = { __typename?: 'Mutation', assignTicket?: { __typename: 'SupportTicket', ticketId: string, userId: string, userEmail: string, userName: string, isPlatinumSupporter: boolean, subject: string, description: string, category: TicketCategory, status: TicketStatus, priority: TicketPriority, createdAt: any, updatedAt: any, resolvedAt?: any | null, closedAt?: any | null, assignedTo?: string | null, responses: Array<{ __typename?: 'TicketResponse', responseId: string, ticketId: string, authorId: string, authorName: string, isAdmin: boolean, content: string, createdAt: any }> } | null };

export type CloseSupportTicketMutationVariables = Exact<{
  ticketId: Scalars['ID']['input'];
}>;


export type CloseSupportTicketMutation = { __typename?: 'Mutation', closeSupportTicket?: { __typename: 'SupportTicket', ticketId: string, userId: string, userEmail: string, userName: string, isPlatinumSupporter: boolean, subject: string, description: string, category: TicketCategory, status: TicketStatus, priority: TicketPriority, createdAt: any, updatedAt: any, resolvedAt?: any | null, closedAt?: any | null, assignedTo?: string | null, responses: Array<{ __typename?: 'TicketResponse', responseId: string, ticketId: string, authorId: string, authorName: string, isAdmin: boolean, content: string, createdAt: any }> } | null };

export type GetUploadUrlMutationVariables = Exact<{
  input: GetUploadUrlInput;
}>;


export type GetUploadUrlMutation = { __typename?: 'Mutation', getUploadUrl?: { __typename?: 'UploadUrl', uploadUrl: string, fileUrl: string, key: string } | null };

export type CheckUsernameAvailabilityQueryVariables = Exact<{
  username: Scalars['String']['input'];
}>;


export type CheckUsernameAvailabilityQuery = { __typename?: 'Query', checkUsernameAvailability: { __typename?: 'UsernameAvailability', available: boolean, username: string } };

export type CheckEmailHasGoogleAccountQueryVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type CheckEmailHasGoogleAccountQuery = { __typename?: 'Query', checkEmailHasGoogleAccount: boolean };

export type UpdateUserProfileMutationVariables = Exact<{
  input: UpdateUserProfileInput;
}>;


export type UpdateUserProfileMutation = { __typename?: 'Mutation', updateUserProfile: { __typename: 'User', userId: string, username: string, email: string, avatarUrl?: string | null, bio?: string | null, favoriteAuthors?: Array<string | null> | null, interests?: Array<string | null> | null, subscriber: boolean, ogSupporter: boolean, createdAt: string, favoriteContributors?: Array<{ __typename: 'Contributor', userId: string, displayName: string, avatarUrl?: string | null } | null> | null, stats: { __typename: 'UserStats', storiesCreated: number, nodesContributed?: number | null, totalUpvotes?: number | null }, subscriptionInfo?: { __typename: 'SubscriptionInfo', tier: SubscriptionTier, status: SubscriptionStatus, stripeCustomerId?: string | null, stripeSubscriptionId?: string | null, periodEnd?: any | null, lastSynced?: string | null, creatorUrl?: string | null } | null, privacySettings?: { __typename: 'UserPrivacySettings', profileVisibility: ProfileVisibility, showStats: boolean } | null, notificationSettings?: { __typename: 'UserNotificationSettings', emailNotifications: boolean, notifyOnReply: boolean, notifyOnUpvote: boolean, notifyOnStoryUpdate: boolean, notificationFrequency: NotificationFrequency } | null, contentSettings?: { __typename: 'UserContentSettings', defaultAgeRatingFilter: AgeRating, hideAIContent: boolean, autoSaveEnabled: boolean } | null } };

export type UpdateUserSettingsMutationVariables = Exact<{
  input: UpdateUserSettingsInput;
}>;


export type UpdateUserSettingsMutation = { __typename?: 'Mutation', updateUserSettings: { __typename: 'User', userId: string, username: string, email: string, bio?: string | null, favoriteAuthors?: Array<string | null> | null, interests?: Array<string | null> | null, subscriber: boolean, ogSupporter: boolean, createdAt: string, favoriteContributors?: Array<{ __typename: 'Contributor', userId: string, displayName: string, avatarUrl?: string | null } | null> | null, stats: { __typename: 'UserStats', storiesCreated: number, nodesContributed?: number | null, totalUpvotes?: number | null }, subscriptionInfo?: { __typename: 'SubscriptionInfo', tier: SubscriptionTier, status: SubscriptionStatus, stripeCustomerId?: string | null, stripeSubscriptionId?: string | null, periodEnd?: any | null, lastSynced?: string | null, creatorUrl?: string | null } | null, privacySettings?: { __typename: 'UserPrivacySettings', profileVisibility: ProfileVisibility, showStats: boolean } | null, notificationSettings?: { __typename: 'UserNotificationSettings', emailNotifications: boolean, notifyOnReply: boolean, notifyOnUpvote: boolean, notifyOnStoryUpdate: boolean, notificationFrequency: NotificationFrequency } | null, contentSettings?: { __typename: 'UserContentSettings', defaultAgeRatingFilter: AgeRating, hideAIContent: boolean, autoSaveEnabled: boolean } | null } };

export type GetReceivedNodeVotesQueryVariables = Exact<{
  userId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetReceivedNodeVotesQuery = { __typename?: 'Query', getReceivedNodeVotes: { __typename: 'ReceivedNodeVotesConnection', nextToken?: string | null, items: Array<{ __typename: 'ReceivedNodeVote', nodeId: string, storyId: string, storyTitle?: string | null, nodePreview?: string | null, voterId: string, voterName: string, voteType: VoteType, votedAt: any }> } };

export type GetReceivedCommentVotesQueryVariables = Exact<{
  userId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetReceivedCommentVotesQuery = { __typename?: 'Query', getReceivedCommentVotes: { __typename: 'ReceivedCommentVotesConnection', nextToken?: string | null, items: Array<{ __typename: 'ReceivedCommentVote', commentId: string, nodeId: string, storyId: string, commentPreview?: string | null, voterId: string, voterName: string, voteType: CommentVoteType, votedAt: any }> } };

export type GetUserContributionsQueryVariables = Exact<{
  userId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetUserContributionsQuery = { __typename?: 'Query', getUserContributions?: { __typename: 'UserContributionsConnection', nextToken?: string | null, items: Array<{ __typename: 'UserContribution', nodeId: string, storyId: string, storyTitle: string, nodeDescription?: string | null, nodeNumber: number, upvotes: number, downvotes: number, createdAt: string }> } | null };

export type SuggestAuthorsQueryVariables = Exact<{
  prefix: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SuggestAuthorsQuery = { __typename?: 'Query', suggestAuthors: Array<{ __typename: 'TagSuggestion', name: string, usageCount: number }> };

export type SuggestInterestsQueryVariables = Exact<{
  prefix: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SuggestInterestsQuery = { __typename?: 'Query', suggestInterests: Array<{ __typename: 'TagSuggestion', name: string, usageCount: number }> };

export type SearchContributorsQueryVariables = Exact<{
  prefix: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchContributorsQuery = { __typename?: 'Query', searchContributors: Array<{ __typename: 'Contributor', userId: string, displayName: string, avatarUrl?: string | null }> };

export type GetUsersByFavoriteAuthorQueryVariables = Exact<{
  author: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetUsersByFavoriteAuthorQuery = { __typename?: 'Query', getUsersByFavoriteAuthor: { __typename: 'UsersByTagConnection', nextToken?: string | null, items: Array<{ __typename: 'UserSummary', userId: string, displayName: string, avatarUrl?: string | null }> } };

export type GetUsersByInterestQueryVariables = Exact<{
  interest: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetUsersByInterestQuery = { __typename?: 'Query', getUsersByInterest: { __typename: 'UsersByTagConnection', nextToken?: string | null, items: Array<{ __typename: 'UserSummary', userId: string, displayName: string, avatarUrl?: string | null }> } };

export type GetUsersByFavoriteContributorQueryVariables = Exact<{
  contributorId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetUsersByFavoriteContributorQuery = { __typename?: 'Query', getUsersByFavoriteContributor: { __typename: 'UsersByTagConnection', nextToken?: string | null, items: Array<{ __typename: 'UserSummary', userId: string, displayName: string, avatarUrl?: string | null }> } };

export type GetAuthorQueryVariables = Exact<{
  name: Scalars['String']['input'];
}>;


export type GetAuthorQuery = { __typename?: 'Query', getAuthor?: { __typename: 'Author', name: string, bio?: string | null, imageUrl?: string | null, wikipediaUrl?: string | null, source?: string | null, createdAt: string, updatedAt: string } | null };

export type ListSupportersQueryVariables = Exact<{ [key: string]: never; }>;


export type ListSupportersQuery = { __typename?: 'Query', listSupporters: { __typename: 'SupportersConnection', platinum: Array<{ __typename: 'Supporter', userId: string, displayName: string, avatarUrl?: string | null, subscriptionTier?: SubscriptionTier | null, ogSupporter: boolean, creatorUrl?: string | null, bio?: string | null }>, gold: Array<{ __typename: 'Supporter', userId: string, displayName: string, avatarUrl?: string | null, subscriptionTier?: SubscriptionTier | null, ogSupporter: boolean, creatorUrl?: string | null, bio?: string | null }>, silver: Array<{ __typename: 'Supporter', userId: string, displayName: string, avatarUrl?: string | null, subscriptionTier?: SubscriptionTier | null, ogSupporter: boolean, creatorUrl?: string | null, bio?: string | null }>, bronze: Array<{ __typename: 'Supporter', userId: string, displayName: string, avatarUrl?: string | null, subscriptionTier?: SubscriptionTier | null, ogSupporter: boolean, creatorUrl?: string | null, bio?: string | null }>, ogSupporters: Array<{ __typename: 'Supporter', userId: string, displayName: string, avatarUrl?: string | null, subscriptionTier?: SubscriptionTier | null, ogSupporter: boolean, creatorUrl?: string | null, bio?: string | null }> } };

export type ListAllUsersQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type ListAllUsersQuery = { __typename?: 'Query', listAllUsers: { __typename: 'UserListResponse', count: number, users: Array<{ __typename: 'UserListItem', userId: string, username: string, email: string, subscriber: boolean, ogSupporter: boolean, createdAt: string, subscriptionInfo?: { __typename: 'SubscriptionInfo', tier: SubscriptionTier, status: SubscriptionStatus, stripeCustomerId?: string | null, lastSynced?: string | null } | null }> } };
