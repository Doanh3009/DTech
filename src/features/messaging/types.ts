export interface ConversationSummary { id:string;type:"direct"|"group";title:string;updatedAt:string;unreadCount:number;lastMessage?:{body:string;senderName:string;createdAt:string};members:Array<{accountId:string;name:string}>; }
export interface MessageAttachment { id:string;fileName:string;mimeType:string;sizeBytes:number; }
export interface ChatMessage { id:string;conversationId:string;senderAccountId:string;senderName:string;body:string;replyToId?:string;createdAt:string;editedAt?:string;attachments:MessageAttachment[];metadata?:{payslipId?:string;payslipPeriod?:string}; }
