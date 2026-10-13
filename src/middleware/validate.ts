import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const quoteRequestSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  config: z.object({
    printMode: z.enum(['bw', 'color']),
    paperSize: z.enum(['A4', 'Legal', 'A3']),
    printSides: z.enum(['single', 'double']),
    copies: z.number().int().min(1).max(100),
    pageSelection: z.enum(['all', 'custom']),
    customPages: z.string().optional(),
    orientation: z.enum(['portrait', 'landscape']).optional(),
    paperType: z.enum(['Normal (75gsm)', 'Bond (100gsm)', 'Glossy Photo (180gsm)']).optional(),
  }),
});

export const orderCreateSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  config: z.object({
    printMode: z.enum(['bw', 'color']),
    paperSize: z.enum(['A4', 'Legal', 'A3']),
    printSides: z.enum(['single', 'double']),
    copies: z.number().int().min(1).max(100),
    pageSelection: z.enum(['all', 'custom']),
    customPages: z.string().optional(),
    orientation: z.enum(['portrait', 'landscape']).optional(),
    paperType: z.enum(['Normal (75gsm)', 'Bond (100gsm)', 'Glossy Photo (180gsm)']).optional(),
  }),
  customerPhone: z.string().max(20).optional(),
  customerNote: z.string().max(300).optional(),
});

export const adminLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const pricingUpdateSchema = z.object({
  bwPricePaise: z.number().int().min(50).max(5000).optional(),
  colorPricePaise: z.number().int().min(100).max(10000).optional(),
  duplexMultiplier: z.number().min(0.5).max(1.0).optional(),
  minOrderPaise: z.number().int().min(100).max(5000).optional(),
  paperSizeRatesPaise: z.record(z.string(), z.number().int()).optional(),
  paperTypeRatesPaise: z.record(z.string(), z.number().int()).optional(),
});

export const agentRegisterSchema = z.object({
  registrationKey: z.string().min(1, 'Registration key is required'),
  machineHostname: z.string().min(1, 'Hostname is required'),
  name: z.string().optional(),
  printers: z
    .array(
      z.object({
        name: z.string(),
        isDefault: z.boolean(),
        status: z.string(),
        supportedPaperSizes: z.array(z.string()),
        supportsColor: z.boolean(),
        supportsDuplex: z.boolean(),
      })
    )
    .optional(),
});

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): any => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        });
      }
      return res.status(400).json({ error: 'Malformed request payload' });
    }
  };
}
