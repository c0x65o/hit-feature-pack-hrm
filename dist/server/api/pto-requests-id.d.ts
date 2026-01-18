import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export declare function GET(request: NextRequest, ctx: {
    params: {
        id: string;
    };
}): Promise<NextResponse<any>>;
export declare function PUT(request: NextRequest, ctx: {
    params: {
        id: string;
    };
}): Promise<NextResponse<any>>;
export declare function DELETE(request: NextRequest, ctx: {
    params: {
        id: string;
    };
}): Promise<NextResponse<unknown>>;
//# sourceMappingURL=pto-requests-id.d.ts.map