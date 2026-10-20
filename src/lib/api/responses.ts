import { NextResponse } from "next/server";

export interface ApiSuccessBody<TData> {
  ok: true;
  data: TData;
}

export function successResponse<TData>(
  data: TData,
  init?: ResponseInit
): NextResponse<ApiSuccessBody<TData>> {
  return NextResponse.json(
    {
      ok: true,
      data
    },
    init
  );
}
