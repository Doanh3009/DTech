import{z}from"zod";
export const conversationCreateSchema=z.discriminatedUnion("type",[z.object({type:z.literal("direct"),accountId:z.string().uuid()}),z.object({type:z.literal("group"),title:z.string().trim().min(2).max(120),accountIds:z.array(z.string().uuid()).min(1).max(100)})]);
export const messageCreateSchema=z.object({body:z.string().trim().min(1).max(8000),replyToId:z.string().uuid().optional()});
export const messageQuerySchema=z.object({cursor:z.string().datetime().optional(),limit:z.coerce.number().int().min(1).max(100).default(50)});
