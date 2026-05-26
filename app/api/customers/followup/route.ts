import { handleApi } from '@/app/lib/api-helper';
import { Customer, LocalOrder, Setting } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const page = Number(url.searchParams.get('page') || '1');
    const limit = Number(url.searchParams.get('limit') || '10');
    const tab = url.searchParams.get('tab') || 'pending';
    const sortField = url.searchParams.get('sortField') || 'lastPurchaseDate';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const outreachStart = url.searchParams.get('outreachStart');
    const outreachEnd = url.searchParams.get('outreachEnd');

    const rangeStartRes    = await Setting.findOne({ key: 'outreach_range_start' });
    const rangeEndRes      = await Setting.findOne({ key: 'outreach_range_end' });
    const repeatOnlyRes    = await Setting.findOne({ key: 'repeat_only_mode' });
    const valueOnlyRes     = await Setting.findOne({ key: 'value_only_mode' });
    const minOrderValRes   = await Setting.findOne({ key: 'min_order_value' });

    const globalStart = rangeStartRes ? Number(rangeStartRes.value) : 32;
    const globalEnd = rangeEndRes ? Number(rangeEndRes.value) : 28;
    const refinedStart = outreachStart ? Number(outreachStart) : globalStart;
    const refinedEnd = outreachEnd ? Number(outreachEnd) : globalEnd;
    const isRepeatOnly = repeatOnlyRes ? !!repeatOnlyRes.value : false;
    const isValueOnly = valueOnlyRes ? !!valueOnlyRes.value : false;
    const minOrderVal = minOrderValRes ? Number(minOrderValRes.value) : 0;

    const now = new Date();
    const broadMin = new Date(); broadMin.setDate(now.getDate() - globalStart); broadMin.setHours(0,0,0,0);
    const broadMax = new Date(); broadMax.setDate(now.getDate() - globalEnd); broadMax.setHours(23,59,59,999);
    const narrowMin = new Date(); narrowMin.setDate(now.getDate() - refinedStart); narrowMin.setHours(0,0,0,0);
    const narrowMax = new Date(); narrowMax.setDate(now.getDate() - refinedEnd); narrowMax.setHours(23,59,59,999);
    const tenDaysAgo = new Date(); tenDaysAgo.setDate(now.getDate() - 10); tenDaysAgo.setHours(0,0,0,0);

    const baseQuery: any = {
      $or: [
        { lastPurchaseDate: { $gte: broadMin, $lte: broadMax } },
        { 'followUpNotes.date': { $gte: tenDaysAgo } },
      ],
    };
    if (isRepeatOnly) baseQuery.purchaseCount = { $gt: 1 };
    if (isValueOnly) baseQuery.totalSpending = { $gte: minOrderVal };
    if (search) {
      baseQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const [candidates, allLocalOrders] = await Promise.all([
      Customer.find(baseQuery).lean(),
      LocalOrder.find({ createdAt: { $gte: tenDaysAgo } }).select('recipient_phone createdAt').lean(),
    ]);

    const segments: Record<string, any[]> = { pending: [], ordered: [], callLater: [], noAnswer: [], notInterested: [], all: [] };

    for (const c of candidates) {
      const lastPurchaseTime = c.lastPurchaseDate ? new Date(c.lastPurchaseDate).getTime() : 0;
      const recentNotes = (c.followUpNotes || []).filter((n: any) => new Date(n.date).getTime() >= tenDaysAgo.getTime());
      const hasRecentNote = recentNotes.length > 0;
      if (hasRecentNote) segments.all.push(c);

      const inBroad = lastPurchaseTime >= broadMin.getTime() && lastPurchaseTime <= broadMax.getTime();
      const inNarrow = lastPurchaseTime >= narrowMin.getTime() && lastPurchaseTime <= narrowMax.getTime();

      if (inBroad) {
        const hasOrder = allLocalOrders.some((o: any) =>
          o.recipient_phone === c.phone && new Date(o.createdAt).getTime() > lastPurchaseTime
        );
        if (hasOrder) {
          if (inNarrow) segments.ordered.push(c);
        } else {
          const notesAfter = (c.followUpNotes || []).filter((n: any) => new Date(n.date).getTime() > lastPurchaseTime);
          const ln = [...notesAfter].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          if (ln && ln.feedback === 'Call Back Later') {
            segments.callLater.push(c);
          } else if (inNarrow) {
            if (!ln) segments.pending.push(c);
            else if (ln.feedback === 'Call Not Received') segments.noAnswer.push(c);
            else segments.notInterested.push(c);
          }
        }
      } else if (hasRecentNote) {
        const ln = [...recentNotes].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        if (allLocalOrders.some((o: any) => o.recipient_phone === c.phone && new Date(o.createdAt).getTime() >= tenDaysAgo.getTime())) {
          segments.ordered.push(c);
        } else if (ln.feedback === 'Call Back Later') segments.callLater.push(c);
        else if (ln.feedback === 'Call Not Received') segments.noAnswer.push(c);
        else if (ln.feedback === 'Not Interested' || ln.feedback === 'Angry') segments.notInterested.push(c);
      }
    }

    const activeList = segments[tab] || segments.pending;
    const orderNum = sortOrder === 'asc' ? 1 : -1;
    activeList.sort((a: any, b: any) => {
      let va, vb;
      if (sortField === 'lastInteractionDate') {
        const mx = (c: any) => c.followUpNotes?.length ? Math.max(...c.followUpNotes.map((n: any) => new Date(n.date).getTime())) : 0;
        va = mx(a); vb = mx(b);
      } else {
        va = a[sortField] ?? 0; vb = b[sortField] ?? 0;
        if (va instanceof Date) va = va.getTime();
        if (vb instanceof Date) vb = vb.getTime();
      }
      return va < vb ? -orderNum : va > vb ? orderNum : 0;
    });

    const skip = (page - 1) * limit;
    return {
      data: activeList.slice(skip, skip + limit),
      total: activeList.length,
      page,
      totalPages: Math.ceil(activeList.length / limit),
      counts: {
        pending: segments.pending.length,
        ordered: segments.ordered.length,
        callLater: segments.callLater.length,
        noAnswer: segments.noAnswer.length,
        notInterested: segments.notInterested.length,
        all: segments.all.length,
      },
    };
  });
}
