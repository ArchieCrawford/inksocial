import { store } from '../state/store.js';
import { UI } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { shortenAddress, formatUsd, formatCompact, formatPercent } from '../utils/format.js';
import { createInkPrintCard } from '../components/inkPrintCard.js';
import { showComposer } from '../components/composer.js';
import { TokenService } from '../services/tokens.js';
import { createChart } from 'lightweight-charts';

export const renderTokenDetail = (container) => {
    const token = store.getState().selectedToken;
    if (!token) {
        container.appendChild(UI.el('div', 'ink-empty', copy.tokens.empty));
        return;
    }

    const backBtn = UI.el('button', 'flex items-center gap-2 p-4 text-slate-400 hover:text-white', '', {
        type: 'button'
    });
    backBtn.innerHTML = `← <span class="font-bold">${copy.tokens.title}</span>`;
    backBtn.onclick = () => store.setState({ view: 'token-search' });
    container.appendChild(backBtn);

    const card = UI.el('div', 'token-detail-card');
    const titleEl = UI.el('div', 'token-detail-title', token.symbol || copy.tokens.unknownSymbol);
    const nameEl = UI.el('div', 'token-detail-name', token.name || copy.tokens.unknownName);
    const shortAddressEl = UI.el('div', 'token-detail-address', shortenAddress(token.address));
    const fullAddressEl = UI.el('div', 'token-detail-contract', token.address);
    card.appendChild(titleEl);
    card.appendChild(nameEl);
    card.appendChild(shortAddressEl);
    card.appendChild(fullAddressEl);
    container.appendChild(card);

    const marketWrap = UI.el('div', 'token-market-grid');
    const makeStat = (label) => {
        const stat = UI.el('div', 'token-stat');
        stat.appendChild(UI.el('div', 'token-stat-label', label));
        const value = UI.el('div', 'token-stat-value', copy.tokens.marketUnavailable);
        stat.appendChild(value);
        return { stat, value };
    };
    const priceStat = makeStat(copy.tokens.market.price);
    const changeStat = makeStat(copy.tokens.market.change);
    const capStat = makeStat(copy.tokens.market.marketCap);
    const volumeStat = makeStat(copy.tokens.market.volume);
    marketWrap.appendChild(priceStat.stat);
    marketWrap.appendChild(changeStat.stat);
    marketWrap.appendChild(capStat.stat);
    marketWrap.appendChild(volumeStat.stat);
    container.appendChild(marketWrap);

    const chartSection = UI.el('div', 'token-chart');
    chartSection.appendChild(UI.el('h3', 'ink-section-title', copy.tokens.market.chartTitle));
    const chartWrap = UI.el('div', 'token-chart-wrap');
    const chartStatus = UI.el('div', 'token-chart-status', copy.tokens.market.chartLoading);
    chartWrap.appendChild(chartStatus);
    chartSection.appendChild(chartWrap);
    container.appendChild(chartSection);

    const metadata = token.metadata || {};
    const description =
        token.description ||
        metadata.description ||
        metadata.safe?.description ||
        metadata.blockscout?.description ||
        metadata.inkypump?.description;

    const descriptionEl = UI.el('p', 'token-detail-description', description || '');
    if (description) {
        container.appendChild(descriptionEl);
    }

    const links =
        token.links ||
        metadata.links ||
        metadata.safe?.links ||
        metadata.blockscout?.links ||
        {};

    if (metadata.inkypump) {
        if (metadata.inkypump.website && !links.website) links.website = metadata.inkypump.website;
        if (metadata.inkypump.twitter && !links.twitter) links.twitter = metadata.inkypump.twitter;
        if (metadata.inkypump.telegram && !links.telegram) links.telegram = metadata.inkypump.telegram;
    }

    const linksWrap = UI.el('div', 'token-detail-links');
    const renderLinks = (linkMap) => {
        UI.clear(linksWrap);
        const entries = Object.entries(linkMap || {}).filter(([, href]) => href);
        if (entries.length === 0) {
            if (linksWrap.parentElement) linksWrap.remove();
            return;
        }
        entries.forEach(([label, href]) => {
            const link = UI.el('a', 'token-detail-link', label, { href, target: '_blank', rel: 'noreferrer' });
            linksWrap.appendChild(link);
        });
        if (!linksWrap.parentElement) container.appendChild(linksWrap);
    };
    renderLinks(links);

    const updateMarket = (market) => {
        if (!market) {
            priceStat.value.textContent = copy.tokens.marketUnavailable;
            changeStat.value.textContent = copy.tokens.marketUnavailable;
            capStat.value.textContent = copy.tokens.marketUnavailable;
            volumeStat.value.textContent = copy.tokens.marketUnavailable;
            changeStat.value.classList.remove('token-stat-positive', 'token-stat-negative');
            return;
        }
        priceStat.value.textContent = formatUsd(market.price_usd, { maximumFractionDigits: 6 });
        capStat.value.textContent = formatCompact(market.market_cap);
        volumeStat.value.textContent = formatCompact(market.volume_24h);
        changeStat.value.textContent = formatPercent(market.percent_change_24h);
        changeStat.value.classList.toggle('token-stat-positive', Number(market.percent_change_24h) > 0);
        changeStat.value.classList.toggle('token-stat-negative', Number(market.percent_change_24h) < 0);
    };

    const renderChart = (candles) => {
        if (!candles || candles.length === 0) {
            chartStatus.textContent = copy.tokens.market.chartEmpty;
            return;
        }
        chartStatus.textContent = '';
        chartWrap.innerHTML = '';

        const chart = createChart(chartWrap, {
            height: 220,
            layout: {
                background: { color: 'transparent' },
                textColor: '#cbd5f5'
            },
            grid: {
                vertLines: { color: 'rgba(148, 163, 184, 0.1)' },
                horzLines: { color: 'rgba(148, 163, 184, 0.1)' }
            },
            rightPriceScale: {
                borderColor: 'rgba(148, 163, 184, 0.2)'
            },
            timeScale: {
                borderColor: 'rgba(148, 163, 184, 0.2)'
            }
        });
        const series = chart.addCandlestickSeries({
            upColor: '#4ade80',
            downColor: '#f87171',
            borderVisible: false,
            wickUpColor: '#4ade80',
            wickDownColor: '#f87171'
        });
        const data = candles
            .map((candle) => ({
                time: Math.floor(new Date(candle.timestamp).getTime() / 1000),
                open: Number(candle.open),
                high: Number(candle.high),
                low: Number(candle.low),
                close: Number(candle.close)
            }))
            .filter((candle) => Number.isFinite(candle.time));
        series.setData(data);
        chart.timeScale().fitContent();

        const resize = () => {
            chart.applyOptions({ width: chartWrap.clientWidth });
        };
        resize();
        const observer = new ResizeObserver(() => resize());
        observer.observe(chartWrap);
    };

    updateMarket(token.market);

    const loadDetail = async () => {
        try {
            const detail = await TokenService.getTokenDetail(token.address);
            if (!detail) return;
            titleEl.textContent = detail.symbol || copy.tokens.unknownSymbol;
            nameEl.textContent = detail.name || copy.tokens.unknownName;
            shortAddressEl.textContent = shortenAddress(detail.address);
            fullAddressEl.textContent = detail.address;
            updateMarket(detail.market);

            const detailMeta = detail.metadata || {};
            const nextDescription =
                detail.description ||
                detailMeta.description ||
                detailMeta.safe?.description ||
                detailMeta.blockscout?.description ||
                detailMeta.inkypump?.description;
            if (nextDescription) {
                descriptionEl.textContent = nextDescription;
                if (!descriptionEl.parentElement) container.appendChild(descriptionEl);
            }

            const nextLinks =
                detail.links ||
                detailMeta.links ||
                detailMeta.safe?.links ||
                detailMeta.blockscout?.links ||
                {};
            if (detailMeta.inkypump) {
                if (detailMeta.inkypump.website && !nextLinks.website) nextLinks.website = detailMeta.inkypump.website;
                if (detailMeta.inkypump.twitter && !nextLinks.twitter) nextLinks.twitter = detailMeta.inkypump.twitter;
                if (detailMeta.inkypump.telegram && !nextLinks.telegram) nextLinks.telegram = detailMeta.inkypump.telegram;
            }
            renderLinks(nextLinks);
        } catch (error) {
            updateMarket(null);
        }
    };

    const loadChart = async () => {
        try {
            const candles = await TokenService.getTokenChart(token.address, { limit: 168 });
            renderChart(candles);
        } catch (error) {
            chartStatus.textContent = copy.tokens.market.chartUnavailable;
        }
    };

    loadDetail();
    loadChart();

    const related = UI.el('div', 'token-detail-related');
    related.appendChild(UI.el('h3', 'ink-section-title', copy.headers.feedTitle));
    container.appendChild(related);

    const symbolTag = token.symbol ? `$${token.symbol.toLowerCase()}` : '';
    const addressTag = token.address ? token.address.toLowerCase() : '';
    const relatedCasts = store.getState().casts.filter(c => {
        const text = c.text.toLowerCase();
        return (symbolTag && text.includes(symbolTag)) || (addressTag && text.includes(addressTag));
    });

    if (relatedCasts.length === 0) {
        related.appendChild(UI.el('div', 'ink-empty', copy.feed.empty));
        return;
    }

    relatedCasts.forEach(c => related.appendChild(createInkPrintCard(c, {
        onOpenThread: (selected) => store.setState({ view: 'thread', selectedCast: selected }),
        onReply: (hash) => showComposer(hash)
    })));
};
