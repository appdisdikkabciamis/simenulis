





        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                    }
                }
            }
        }
    

        // Ganti URL ini dengan URL Web App Apps Script Anda yang baru
        const scriptURL = 'https://script.google.com/macros/s/AKfycbxBFvluoYF9ghU54oTzcWcBqZWvotfI67DuM-TiXjslFWUf3keiday9u38hN2YIiFrunA/exec';
        
        let globalData = [];
        let filteredData = [];
        let currentPage = 1;
        let rowsPerPage = 10;
        let myChart = null; // Variable untuk menyimpan instance grafik

        document.addEventListener('DOMContentLoaded', () => {
            // Mendaftarkan plugin data labels ke global Chart.js
            Chart.register(ChartDataLabels);
            
            loadData();
            
            // Search & Filter event listeners
            document.getElementById('searchInput').addEventListener('input', applyFilters);
        });

        function changeRowsPerPage(select) {
            rowsPerPage = parseInt(select.value);
            currentPage = 1;
            renderTable();
        }

        function changePage(page) {
            const totalPages = Math.ceil(filteredData.length / rowsPerPage);
            if (page < 1 || page > totalPages) return;
            currentPage = page;
            renderTable();
        }

        function loadData() {
            const tableBody = document.getElementById('tableBody');
            const loader = document.getElementById('loader');
            const errorMessage = document.getElementById('errorMessage');
            const emptyState = document.getElementById('emptyState');
            
            tableBody.innerHTML = '';
            document.getElementById('paginationInfo').innerText = '';
            document.getElementById('paginationControls').innerHTML = '';
            document.getElementById('chartContainer').classList.add('hidden');
            
            loader.classList.remove('hidden');
            loader.classList.add('flex');
            errorMessage.classList.add('hidden');
            errorMessage.classList.remove('flex');
            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');

            fetch(scriptURL)
                .then(response => {
                    if (!response.ok) throw new Error("Jaringan bermasalah");
                    return response.json();
                })
                .then(result => {
                    loader.classList.add('hidden');
                    loader.classList.remove('flex');
                    if (result.status === 'success' && result.data) {

                        // Tampilkan info update jika ada
                        const updateInfoContainer = document.getElementById('updateInfoContainer');
                        const updateInfoText = document.getElementById('updateInfoText');
                        if (result.updateInfo && result.updateInfo.trim() !== '') {
                            let dateStr = result.updateInfo;
                            try {
                                const d = new Date(dateStr);
                                if (!isNaN(d.getTime())) {
                                    dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                                }
                            } catch(e) {}
                            updateInfoText.textContent = dateStr;
                            updateInfoContainer.classList.remove('hidden');
                        } else {
                            updateInfoContainer.classList.add('hidden');
                        }

                        // Tampilkan video YouTube jika ada
                        const videoContainer = document.getElementById('videoContainer');
                        const videoList = document.getElementById('videoList');
                        
                        let videosData = result.videos || [];
                        if (videosData.length === 0 && result.videoLink && result.videoLink.trim() !== '') {
                            videosData = [{ url: result.videoLink.trim(), title: '' }];
                        }

                        if (videosData.length > 0) {
                            videoList.innerHTML = '';
                            
                            videosData.forEach(video => {
                                let embedUrl = video.url.trim();
                                let videoId = '';
                                
                                try {
                                    if (embedUrl.includes('youtu.be/')) {
                                        videoId = embedUrl.split('youtu.be/')[1].split('?')[0];
                                    } else if (embedUrl.includes('youtube.com/watch')) {
                                        videoId = new URL(embedUrl).searchParams.get('v');
                                    } else if (embedUrl.includes('youtube.com/embed/')) {
                                        videoId = embedUrl.split('youtube.com/embed/')[1].split('?')[0];
                                    }
                                } catch (e) {
                                    console.error('Error parsing YouTube URL', e);
                                }
                                
                                const finalUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : embedUrl;
                                const titleHtml = video.title ? `<h3 class="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 text-center" title="${escapeHTML(video.title)}">${escapeHTML(video.title)}</h3>` : '';
                                
                                const videoItem = document.createElement('div');
                                videoItem.className = 'w-full flex flex-col';
                                videoItem.innerHTML = `
                                    <div class="relative w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900" style="padding-top: 56.25%;">
                                        <iframe class="absolute top-0 left-0 w-full h-full pointer-events-auto" src="${finalUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                                    </div>
                                    ${titleHtml}
                                `;
                                videoList.appendChild(videoItem);
                            });
                            
                            videoContainer.classList.remove('hidden');
                        } else {
                            videoContainer.classList.add('hidden');
                            videoList.innerHTML = '';
                        }

                        globalData = result.data.map(row => {
                            let currentStatus = '';
                            if (row['Status']) {
                                const s = String(row['Status']).toLowerCase().trim();
                                if (s.includes('ditandatangani kepala sekolah')) {
                                    row['Status'] = 'Sudah TTD Kepsek';
                                    currentStatus = 'sudah ttd kepsek';
                                } else if (s.includes('proses pengisian data')) {
                                    row['Status'] = 'Mengisi Biodata';
                                    currentStatus = 'mengisi biodata';
                                } else {
                                    currentStatus = s;
                                }
                            }
                            
                            // Auto-ceklis berdasarkan status
                            if (row.isRejected || currentStatus.includes('tolak') || currentStatus === 'verval ditolak') {
                                row['Biodata'] = 'ada';
                            } else if (currentStatus === 'sudah ttd kepsek') {
                                row['Biodata'] = 'ada';
                                row['PKS'] = 'ada';
                                row['SPTJM'] = 'ada';
                            } else if (currentStatus === 'mengisi biodata') {
                                row['Biodata'] = 'ada';
                            }

                            return row;
                        });
                        
                        // Urutkan data berdasarkan status prioritas, lalu Kecamatan
                        globalData.sort((a, b) => {
                            const getWeight = (row) => {
                                if (row.isRejected) return 1;
                                const rawStatus = String(row['Status'] || '').toLowerCase().trim();
                                if (!rawStatus || rawStatus === '0%' || rawStatus === 'belum mulai' || rawStatus === 'belum' || rawStatus === '-') return 2;
                                if (rawStatus.includes('100%') || rawStatus === 'selesai' || rawStatus === 'lengkap') return 4;
                                return 3;
                            };
                            
                            const weightA = getWeight(a);
                            const weightB = getWeight(b);
                            
                            if (weightA !== weightB) {
                                return weightA - weightB;
                            }
                            
                            // Jika status sama, urutkan berdasarkan kecamatan A-Z
                            const kecA = String(a['Kecamatan'] || '').toLowerCase();
                            const kecB = String(b['Kecamatan'] || '').toLowerCase();
                            if (kecA < kecB) return -1;
                            if (kecA > kecB) return 1;
                            return 0;
                        });

                        // Populate dropdown filter Kecamatan secara dinamis
                        populateKecamatanFilter();

                        filteredData = [...globalData];
                        currentPage = 1;
                        
                        // Tampilkan komponen dinamis
                        updateSummaryCards(filteredData);
                        renderChart(filteredData); // Gambar grafik bar
                        renderTable();
                    } else {
                        throw new Error(result.message || "Data format tidak valid");
                    }
                })
                .catch(error => {
                    console.error('Error fetching data:', error);
                    loader.classList.add('hidden');
                    loader.classList.remove('flex');
                    errorMessage.classList.remove('hidden');
                    errorMessage.classList.add('flex');
                });
        }

        function populateKecamatanFilter() {
            const filterKecamatan = document.getElementById('filterKecamatan');
            const kecSet = new Set();
            
            globalData.forEach(row => {
                if (row['Kecamatan']) {
                    kecSet.add(row['Kecamatan']);
                }
            });

            // Reset dan masukkan kembali opsi Semua Kecamatan
            filterKecamatan.innerHTML = '<option value="">Semua Kecamatan</option>';
            
            // Urutkan alfabet dan buat option
            const sortedKec = Array.from(kecSet).sort();
            sortedKec.forEach(kec => {
                const opt = document.createElement('option');
                opt.value = kec;
                opt.textContent = kec;
                filterKecamatan.appendChild(opt);
            });
        }

        function applyFilters() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const filterKec = document.getElementById('filterKecamatan').value;
            const filterStat = document.getElementById('filterStatus').value;
            
            filteredData = globalData.filter(row => {
                // Pencarian Teks
                const nama = String(row['Nama Sekolah'] || '').toLowerCase();
                const npsn = String(row['NPSN'] || '').toLowerCase();
                const kecName = String(row['Kecamatan'] || '').toLowerCase();
                const matchSearch = !searchTerm || nama.includes(searchTerm) || npsn.includes(searchTerm) || kecName.includes(searchTerm);
                
                // Filter Kecamatan
                const matchKec = !filterKec || row['Kecamatan'] === filterKec;
                
                // Filter Status
                let matchStat = true;
                if (filterStat) {
                    const rawStatus = String(row['Status'] || '').toLowerCase().trim();
                    let rowStatCategory = rawStatus;
                    
                    if (row.isRejected || rawStatus.includes('tolak') || rawStatus === 'verval ditolak') {
                        rowStatCategory = 'verval ditolak';
                    } else if (!rawStatus || rawStatus === '0%' || rawStatus === 'belum mulai' || rawStatus === 'belum' || rawStatus === '-') {
                        rowStatCategory = 'belum mulai';
                    } else if (rawStatus.includes('sudah ttd kepsek')) {
                        rowStatCategory = 'sudah ttd kepsek';
                    } else if (rawStatus.includes('mengisi biodata')) {
                        rowStatCategory = 'mengisi biodata';
                    }

                    matchStat = rowStatCategory === filterStat;
                }

                return matchSearch && matchKec && matchStat;
            });

            // Urutkan data berdasarkan status prioritas, lalu Kecamatan
            filteredData.sort((a, b) => {
                const getWeight = (row) => {
                    if (row.isRejected) return 1;
                    const rawStatus = String(row['Status'] || '').toLowerCase().trim();
                    if (!rawStatus || rawStatus === '0%' || rawStatus === 'belum mulai' || rawStatus === 'belum' || rawStatus === '-') return 2;
                    if (rawStatus.includes('100%') || rawStatus === 'selesai' || rawStatus === 'lengkap') return 4;
                    return 3;
                };
                
                const weightA = getWeight(a);
                const weightB = getWeight(b);
                
                if (weightA !== weightB) {
                    return weightA - weightB;
                }
                
                // Jika status sama, urutkan berdasarkan kecamatan A-Z
                const kecA = String(a['Kecamatan'] || '').toLowerCase();
                const kecB = String(b['Kecamatan'] || '').toLowerCase();
                if (kecA < kecB) return -1;
                if (kecA > kecB) return 1;
                return 0;
            });

            currentPage = 1;
            
            // Perbarui grafik, kartu dan tabel sesuai dengan data yang ter-filter
            updateSummaryCards(filteredData);
            renderChart(filteredData);
            renderTable();
        }

        function updateSummaryCards(data) {
            let total = data.length;
            let belum = 0;
            let proses = 0;
            let ditolak = 0;

            data.forEach(row => {
                const status = String(row['Status'] || '').toLowerCase().trim();
                
                // Logika penghitungan
                if (row.isRejected) {
                    ditolak++;
                } else if (!status || status === '0%' || status === 'belum mulai' || status === 'belum' || status === '-') {
                    belum++;
                } else if (status.includes('100%') || status === 'selesai' || status === 'lengkap') {
                    // Selesai
                } else {
                    proses++;
                }
            });

            // Update DOM element
            document.getElementById('countTotal').innerText = total;
            document.getElementById('countBelum').innerText = belum;
            document.getElementById('countProses').innerText = proses;
            document.getElementById('countDitolak').innerText = ditolak;
        }

        function renderChart(data) {
            const chartContainer = document.getElementById('chartContainer');
            
            if(data.length === 0) {
                chartContainer.classList.add('hidden');
                return;
            } else {
                chartContainer.classList.remove('hidden');
            }

            const ctx = document.getElementById('kecamatanChart').getContext('2d');
            
            // Kelompokkan data per kecamatan
            const kecMap = {};
            
            data.forEach(row => {
                let rawKec = String(row['Kecamatan'] || 'Tidak Diketahui').trim();
                // Hapus kata Kec. atau Kecamatan di awal kalimat
                let kec = rawKec.replace(/^Kec(?:amatan)?\.?\s+/i, '').trim();

                if (!kecMap[kec]) {
                    kecMap[kec] = { total: 0, proses: 0 };
                }
                
                kecMap[kec].total++; // Hitung total sekolah
                
                const status = String(row['Status'] || '').toLowerCase().trim();
                if (!status || status === '0%' || status === 'belum mulai' || status === 'belum' || status === '-') {
                    // Abaikan
                } else if (status.includes('100%') || status === 'selesai' || status === 'lengkap') {
                    // Abaikan
                } else {
                    kecMap[kec].proses++;
                }
            });

            // Urutkan label (kecamatan) berdasarkan persentase Dalam Proses dari yang terbesar
            const labels = Object.keys(kecMap).sort((a, b) => {
                const pctA = kecMap[a].total === 0 ? 0 : (kecMap[a].proses / kecMap[a].total) * 100;
                const pctB = kecMap[b].total === 0 ? 0 : (kecMap[b].proses / kecMap[b].total) * 100;
                return pctB - pctA;
            });
            
            const dataProses = labels.map(kec => {
                if (kecMap[kec].total === 0) return 0;
                return parseFloat(((kecMap[kec].proses / kecMap[kec].total) * 100).toFixed(1));
            });

            // Hancurkan instance chart lama jika sudah ada
            if (myChart) {
                myChart.destroy();
            }

            // Buat Bar Chart baru (Persentase Dalam Proses)
            myChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Dalam Proses (%)',
                            data: dataProses,
                            backgroundColor: '#0e3f82',
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 25 // Beri ruang ekstra di atas agar label tidak terpotong
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                minRotation: 90,
                                maxRotation: 90
                            }
                        },
                        y: {
                            beginAtZero: true,
                            max: 100, // Karena persentase, batas maksimalnya 100
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false // Sembunyikan legenda karena hanya ada 1 tipe data
                        },
                        datalabels: {
                            anchor: 'end',
                            align: 'top',
                            color: '#64748b',
                            font: {
                                size: 10,
                                weight: 'bold'
                            },
                            formatter: function(value, context) {
                                const kec = context.chart.data.labels[context.dataIndex];
                                const proses = kecMap[kec].proses;
                                const total = kecMap[kec].total;
                                // Tampilkan angka mentahnya (misal: 5/10)
                                if (total === 0) return '';
                                return proses + '/' + total;
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const kec = context.label;
                                    const pct = context.parsed.y;
                                    const proses = kecMap[kec].proses;
                                    const total = kecMap[kec].total;
                                    return pct + '% (' + proses + ' dari ' + total + ' sekolah)';
                                }
                            }
                        }
                    }
                }
            });
        }

        function renderTable() {
            const tableBody = document.getElementById('tableBody');
            const emptyState = document.getElementById('emptyState');
            
            tableBody.innerHTML = '';
            
            if (filteredData.length === 0) {
                emptyState.classList.remove('hidden');
                emptyState.classList.add('flex');
                document.getElementById('paginationInfo').innerText = '';
                document.getElementById('paginationControls').innerHTML = '';
                return;
            } else {
                emptyState.classList.add('hidden');
                emptyState.classList.remove('flex');
            }

            // Hitung data untuk pagination
            const startIndex = (currentPage - 1) * rowsPerPage;
            const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
            const paginatedData = filteredData.slice(startIndex, endIndex);

            // Perbarui teks info pagination
            document.getElementById('paginationInfo').innerText = `Menampilkan ${startIndex + 1} sampai ${endIndex} dari ${filteredData.length} entri`;

            paginatedData.forEach(row => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150";
                
                tr.innerHTML = `
                    <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">${escapeHTML(row['Kecamatan'] || '-')}</td>
                    <td class="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">${escapeHTML(row['NPSN'] || '-')}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 leading-snug min-w-[200px]">${escapeHTML(row['Nama Sekolah'] || '-')}</td>
                    <td class="px-4 py-3">${formatIcon(row['Biodata'])}</td>
                    <td class="px-4 py-3">${formatIcon(row['PKS'])}</td>
                    <td class="px-4 py-3">${formatIcon(row['SPTJM'])}</td>
                    <td class="px-4 py-3">${formatIcon(row['TTD PPK'])}</td>
                    <td class="px-4 py-3">${formatIcon(row['E-Materai'])}</td>
                    <td class="px-4 py-3 whitespace-nowrap">${row.isRejected ? formatProgres('Verval Ditolak') : formatProgres(row['Status'])}</td>
                `;
                
                tableBody.appendChild(tr);
            });

            renderPagination();
        }

        function renderPagination() {
            const totalPages = Math.ceil(filteredData.length / rowsPerPage);
            const paginationControls = document.getElementById('paginationControls');
            let html = '';

            // Prev Button
            const prevDisabled = currentPage === 1;
            html += `<button onclick="changePage(${currentPage - 1})" class="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-l-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors ${prevDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-600 dark:hover:text-blue-400'}" ${prevDisabled ? 'disabled' : ''}>Prev</button>`;

            // Menampilkan maksimal 5 halaman di sekitar current page
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            if (endPage - startPage < 4) {
                startPage = Math.max(1, endPage - 4);
            }

            for (let i = startPage; i <= endPage; i++) {
                if (i === currentPage) {
                    html += `<button onclick="changePage(${i})" class="px-3.5 py-1.5 border-t border-b border-r border-blue-500 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold z-10 transition-colors focus:outline-none">${i}</button>`;
                } else {
                    const borderLeft = (i === startPage && startPage > 1) ? 'border-l' : '';
                    html += `<button onclick="changePage(${i})" class="px-3.5 py-1.5 border-t border-b border-r ${borderLeft} border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none">${i}</button>`;
                }
            }

            // Next Button
            const nextDisabled = currentPage === totalPages || totalPages === 0;
            html += `<button onclick="changePage(${currentPage + 1})" class="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-r-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors ${nextDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-600 dark:hover:text-blue-400'}" ${nextDisabled ? 'disabled' : ''}>Next</button>`;

            paginationControls.innerHTML = html;
        }

        // Helper untuk memformat teks "Ada/Belum" menjadi ikon ceklis dan cakra berbulatan
        function formatIcon(value) {
            if (!value) return `<div class="flex justify-center"><span class="text-slate-300 font-bold">-</span></div>`;
            
            const valLower = String(value).toLowerCase().trim();
            
            // Kata kunci yang dianggap positif (Ceklis bulat)
            if (valLower === 'ada' || valLower === 'sudah' || valLower === 'selesai' || valLower === 'ya' || valLower === 'v' || valLower === '✓' || valLower === 'true' || valLower.includes('sudah')) {
                return `<div class="flex justify-center" title="${escapeHTML(value)}">
                    <svg class="w-6 h-6 text-emerald-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd" />
                    </svg>
                </div>`;
            } 
            // Kata kunci yang dianggap negatif (Cakra bulat)
            else if (valLower === 'tidak' || valLower === 'tidak ada' || valLower === 'x' || valLower === 'false' || valLower === 'ditolak') {
                return `<div class="flex justify-center" title="${escapeHTML(value)}">
                    <svg class="w-6 h-6 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clip-rule="evenodd" />
                    </svg>
                </div>`;
            } 
            // Kata kunci untuk status belum (Garis strip netral)
            else if (valLower === 'belum' || valLower === 'belum ada') {
                return `<div class="flex justify-center" title="${escapeHTML(value)}"><span class="text-slate-400 font-bold text-xl">-</span></div>`;
            } 
            // Jika nilai bukan ada/belum (misalnya teks lain)
            else {
                return `<div class="flex justify-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">${escapeHTML(value)}</span>
                </div>`;
            }
        }

        // Khusus kolom Status Progres
        function formatProgres(value) {
            if (!value) return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">-</span>`;
            
            const val = String(value).toLowerCase().trim();
            let badgeClasses = 'bg-blue-100 text-blue-700';
            
            if (val === 'ditolak' || val === 'verval ditolak') {
                badgeClasses = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800';
            } else if (val.includes('100%') || val === 'selesai' || val === 'lengkap') {
                badgeClasses = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
            } else if (val === '0%' || val === 'belum mulai') {
                badgeClasses = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600';
            } else {
                badgeClasses = 'bg-amber-100 text-amber-700';
            }
            
            return `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${badgeClasses}">${escapeHTML(value)}</span>`;
        }

        function escapeHTML(str) {
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        async function downloadPDF() {
            // Filter globalData untuk "verval ditolak" dan "belum mulai"
            const dataToExport = globalData.filter(row => {
                const rawStatus = String(row['Status'] || '').toLowerCase().trim();
                let isDitolak = row.isRejected || rawStatus.includes('tolak') || rawStatus === 'verval ditolak';
                let isBelum = !rawStatus || rawStatus === '0%' || rawStatus === 'belum mulai' || rawStatus === 'belum' || rawStatus === '-';
                return isDitolak || isBelum;
            });

            if (dataToExport.length === 0) {
                alert('Tidak ada data sekolah dengan status Ditolak atau Belum Dimulai.');
                return;
            }

            // Ambil Update Terakhir dari element
            const updateInfoText = document.getElementById('updateInfoText').textContent;
            const updateText = updateInfoText ? `Update Terakhir: ${updateInfoText}` : '';

            // Setup jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'pt', 'a4'); // Portrait

            // Buat icon PNG dari SVG menggunakan canvas
            const svgString = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#ffffff" width="64" height="64"><path stroke-linecap="round" stroke-linejoin="round" d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /><path stroke-linecap="round" stroke-linejoin="round" d="m15 5 4 4" /></svg>`;
            
            try {
                const imgDataUrl = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = 64;
                        canvas.height = 64;
                        const ctx = canvas.getContext('2d');
                        
                        // Gambar rounded rect background
                        ctx.fillStyle = '#0e3f82';
                        ctx.beginPath();
                        ctx.moveTo(12, 0);
                        ctx.arcTo(64, 0, 64, 64, 12);
                        ctx.arcTo(64, 64, 0, 64, 12);
                        ctx.arcTo(0, 64, 0, 0, 12);
                        ctx.arcTo(0, 0, 64, 0, 12);
                        ctx.closePath();
                        ctx.fill();
                        
                        // Gambar SVG icon dengan padding agar tidak terlalu besar
                        // Kotak berukuran 64x64, kita gambar icon ukuran 40x40 di posisi (12, 12)
                        ctx.drawImage(img, 12, 12, 40, 40);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    img.onerror = reject;
                    img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
                });
                
                doc.addImage(imgDataUrl, 'PNG', 40, 30, 26, 26);
            } catch (e) {
                console.error("Gagal render icon SVG", e);
                // Fallback kotak biru
                doc.setFillColor(14, 63, 130);
                doc.roundedRect(40, 30, 26, 26, 4, 4, 'F');
            }

            // Tambahkan Teks "DASBOR SIMENULIS"
            doc.setFontSize(15);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(11, 37, 69); // #0B2545
            doc.text("DASBOR SIMENULIS", 74, 42);

            // Tambahkan Teks "KABUPATEN CIAMIS"
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(11, 37, 69); // #0B2545
            doc.text("KABUPATEN CIAMIS", 74, 54);

            // Pill TA 2026
            doc.setFillColor(14, 63, 130); // #0e3f82
            doc.roundedRect(240, 32, 48, 14, 7, 7, 'F');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text("TA 2026", 248, 42);

            // Judul Tabel
            doc.setFontSize(13);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text("Daftar Sekolah - Status Verval Ditolak & Belum Mulai", 40, 90);

            // Teks Update Terakhir
            if (updateText) {
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 100, 100);
                doc.text(updateText, 40, 105);
            }

            // Kolom tabel
            const columns = ["No", "Kecamatan", "NPSN", "Nama Sekolah", "Status"];
            const rows = dataToExport.map((row, index) => {
                let currentStatus = '';
                const rawStatus = String(row['Status'] || '').toLowerCase().trim();
                if (row.isRejected || rawStatus.includes('tolak') || rawStatus === 'verval ditolak') {
                    currentStatus = 'Verval Ditolak';
                } else {
                    currentStatus = 'Belum Mulai';
                }
                
                return [
                    index + 1,
                    row['Kecamatan'] || '-',
                    row['NPSN'] || '-',
                    row['Nama Sekolah'] || '-',
                    currentStatus
                ];
            });

            doc.autoTable({
                head: [columns],
                body: rows,
                startY: 120,
                styles: { fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [14, 63, 130] }, // Warna biru tema
                alternateRowStyles: { fillColor: [245, 247, 250] },
                margin: { top: 120, right: 40, bottom: 40, left: 40 }
            });

            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const fileName = `Daftar_Sekolah_Ditolak_Belum_Mulai_${yyyy}${mm}${dd}_${hh}${min}${ss}.pdf`;
            doc.save(fileName);
        }

        // Dark Mode Toggle Logic
        function toggleDarkMode() {
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            }
        }
        
        // Init Dark Mode from localStorage or system preference
        if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    

