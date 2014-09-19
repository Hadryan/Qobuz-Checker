var langs      = [];
var artists    = {};
var chromeI18n = chrome.i18n.getMessage;
var filesearch;
var closestLang;

for (var i = 0, tmp, elements = document.getElementsByTagName('*'), length = elements.length; i != length; i++) {
    tmp = elements[i].id;
    if (tmp != '')
        window[tmp] = document.getElementById(tmp);
}

window.addEventListener('load', function() {
    restore.value           = chromeI18n('restore');
    backup.value            = chromeI18n('backup');
    artistsname.placeholder = chromeI18n('name');
    confirmtext.innerHTML   = chromeI18n('confirm');
    confirmno.value         = chromeI18n('no');
    confirmyes.value        = chromeI18n('yes');

    var file = new XMLHttpRequest();
    file.open('GET', 'http://www.qobuz.com', true);
    file.setRequestHeader('Pragma', 'no-cache');
    file.setRequestHeader('Cache-Control', 'no-cache, must-revalidate');
    file.onreadystatechange = function() {
        if (file.readyState == XMLHttpRequest.DONE) {
            divArtists.classList.remove('loading');
            if (file.status == 200) {
                var response = file.responseText;
                var regExp1  = /<li class="icon-country [^>]*>\s*<a href="([^"]*)/g;
                var regExp2  = /<li class="icon-country [^>]*>\s*<span>[^<]*<\/span>\s*<div>\s*<a href="([^"]*)"[^>]*>[^<]*<\/a>\s*<a href="([^"]*)/g;
                var tmp;
                while ((tmp = regExp1.exec(response)) != null) {
                    if (tmp[1] == '/')
                        tmp[1] = '/fr-fr/';
                    langs.push(tmp[1]);
                }
                while ((tmp = regExp2.exec(response)) != null)
                    langs.push(tmp[1], tmp[2]);

                closestLang = file.responseURL.replace('http://www.qobuz.com', '');
                for (var i = 0, length = langs.length; i != length; i++) {
                    if (langs[i] == closestLang) {
                        closestLang = i;
                        break;
                    }
                }

                container.hidden = false;
                chrome.storage.local.get(null, function(items) {
                    if (items['artists'])
                        artists = items['artists'];
                    for (var artist in artists)
                        checkArtist(artist);
                });
            }
            else showError(chromeI18n('unreachable'), '', divArtists);
        }
    };
    file.send();
}, false);

function compareStrings(string1, string2) {
    return string1.localeCompare(string2, window.navigator.language, { 'sensitivity': 'accent' });
}

function propertyInArray(value, property, array) {
    var i, length;
    for (i = 0, length = array.length; i != length && array[i][property] != value; i++) {}
    return i == length ? -1 : i;
}

function writeArtists() {
    chrome.storage.local.set({ 'artists': artists });
}

document.addEventListener('click', function() {
    artistsresults.classList.remove('visible');
    artistsresults.innerHTML = '';
}, false);

artistsname.addEventListener('keypress', function(e) {
    if (e.keyCode == 13)
        artistssearch.click();
}, false);

artistssearch.addEventListener('click', function() {
    var string = artistsname.value.trim();
    if (string == '') {
        showError(chromeI18n('empty'), null, container);
        return;
    }
    artistsresults.classList.remove('visible');
    artistsresults.innerHTML = '';

    try {
        filesearch.abort();
    }
    catch (err) {}

    artistsname.classList.add('loading');

    filesearch = new XMLHttpRequest();
    filesearch.open('GET', 'http://www.qobuz.com/qbPackageSearchEnginePlugin/php/autocomplete-proxy.php?utf8=%E2%9C%93&q=' + encodeURIComponent(string), true);
    filesearch.onreadystatechange = function() {
        if (filesearch.readyState == XMLHttpRequest.DONE) {
            artistsname.classList.remove('loading');
            if (filesearch.status == 200) {
                var output               = parseResults(filesearch.responseText);
                artistsresults.innerHTML = output;
                if (output != '') {
                    for (var i = 0, values = artistsresults.getElementsByTagName('a'), length = values.length; i != length; i++)
                        values[i].addEventListener('click', function(e) {
                            artistsname.value = '';
                            var value         = e.target.id;
                            artists[value]    = [];
                            writeArtists();
                            checkArtist(value);
                        }, false);
                    artistsresults.classList.add('visible');
                }
                else showError(chromeI18n('noresults'), null, container);
            }
            else if (filesearch.status != 0)
                showError(chromeI18n('unreachable'), '/qbPackageSearchEnginePlugin/php/autocomplete-proxy.php?utf8=%E2%9C%93&q=' + encodeURIComponent(string), container);
        }
    };
    filesearch.send();
}, false);

function parseResults(response) {
    var regExp = /%%store_for_autocomplete%%\/interpreter\/([^\/]*)[^"]*"\s*class="overflow" rel="([^"]*)/g, tmp, output = '';
    while ((tmp = regExp.exec(response)) != null) {
        if (!(tmp[1] in artists))
            output += '<li><a id="' + tmp[1] + '">' + tmp[2] + '</a></li>';
    }
    return output;
}

restoreh.addEventListener('change', function(event) {
    var file    = new FileReader();
    file.onload = function(e) {
        event.target.value = '';
        try {
            artists = JSON.parse(e.target.result)['artists'];
            writeArtists();
            divArtists.innerHTML = '';
            for (var artist in artists)
                checkArtist(artist);
        }
        catch (err) {
            showError(chromeI18n('jsoncompliant'), container);
        }
    };
    file.readAsText(event.target.files[0]);
}, false);

restore.addEventListener('click', function() {
    restoreh.click();
}, false);

backup.addEventListener('click', function() {
    var a      = document.createElement('a');
    a.download = 'backup.json';
    a.href     = window.URL.createObjectURL(new Blob([JSON.stringify({ 'artists': artists }, null, 4)], { 'type': 'text/plain;charset=UTF-8' }));
    a.click();
    window.URL.revokeObjectURL(a.href);
}, false);

function showError(string, link, element, top) {
    var p       = document.createElement('p');
    p.className = 'alert';
    if (link != null)
        p.innerHTML = '<a href="http://www.qobuz.com' + link + '" target="_blank">' + string + '</a><a class="alert-close" title="' + chromeI18n('delete') + '">&times;</a>';
    else p.innerHTML = '<span>' + string + '</span><a class="alert-close" title="' + chromeI18n('delete') + '">&times;</a>';
    p.lastElementChild.addEventListener('click', function(e) {
        element.removeChild(e.target.parentElement);
    }, false);
    if (top)
        element.insertBefore(p, element.children[2])
    else element.appendChild(p);
}

function checkArtist(artist) {
    var divArtist       = document.createElement('div');
    divArtist.id        = artist;
    divArtist.className = 'artist';
    divArtist.innerHTML = '<p class="alert notice"><a href="http://www.qobuz.com' + langs[closestLang] + 'interpreter/' + artist + '/download-streaming-albums" target="_blank">' + artist + '</a><a class="alert-close" title="' + chromeI18n('delete') + '" hidden>&times;</a></p><div id="' + artist + 'progress" class="progress"><span style="width: 0%"></span>0%</div><div id="' + artist + 'new" class="new"></div><div id="' + artist + 'old" class="old"></div>';
    divArtist.firstElementChild.lastElementChild.addEventListener('click', function(e) {
        confirmyes.onclick = function() {
            divArtists.removeChild(e.target.parentElement.parentElement);
            delete artists[artist];
            writeArtists();
            confirmfade.click();
        };
        confirmlight.classList.add('visible');
        confirmfade.classList.add('visible');
    }, false);
    var i = 0, children = divArtists.children, length = children.length;
    for ( ; i != length && compareStrings(children[i].firstElementChild.firstElementChild.innerHTML, artist) < 0; i++) {}
    divArtists.insertBefore(divArtist, i != length ? children[i] : null);

    for (var i = 0, length = langs.length; i != length; i++)
        checkArtistPage(artists[artist], langs[i], i == closestLang, artist, divArtist, 1);
}

function checkArtistPage(albums, lang, isClosestLang, artist, divArtist, page, end, albumCount) {
    if (page == end)
        return;
    var file = new XMLHttpRequest();
    file.open('GET', 'http://www.qobuz.com' + lang + 'interpreter/' + artist + '/download-streaming-albums?page=' + page, true);
    file.setRequestHeader('Pragma', 'no-cache');
    file.setRequestHeader('Cache-Control', 'no-cache, must-revalidate');
    file.onreadystatechange = function() {
        if (file.readyState == XMLHttpRequest.DONE) {
            if (file.status == 200 && file.responseURL.match(new RegExp('^http://www.qobuz.com' + lang + 'interpreter/'))) {
                var response = file.responseText;
                var realName = response.match(/<h1>([^<]*)/)[1];
                if (divArtist.firstElementChild.firstElementChild.innerHTML == artist)
                    divArtist.firstElementChild.firstElementChild.innerHTML = realName;

                if (end == null) {
                    end    = 0;
                    regExp = /\?page=([1-9][0-9]*)/g;
                    while ((tmp = regExp.exec(response)) != null)
                        if (parseInt(tmp[1]) > end)
                            end = parseInt(tmp[1]);
                    end++;
                    albumCount = response.match(/<i class="icon-info-sign"><\/i>\s*<b>([^<]*)/)[1];
                }

                var regExp = /<div class="album-title">\s*<a href="([^"]*\/([0-9]+))" [^>]*>\s*([^<]*)/g;
                var tmp;
                while ((tmp = regExp.exec(response)) != null) {
                    var element = document.getElementById(tmp[2]);
                    if (element == null) {
                        var divAlbum       = document.createElement('div');
                        divAlbum.className = 'album';
                        divAlbum.innerHTML = '<span class="switch unicode"><input id="' + tmp[2] + '" type="checkbox"><label for="' + tmp[2] + '" data-on="✓" data-off="✕"></label></span><a href="http://www.qobuz.com' + tmp[1] + '" target="_blank">' + tmp[3].trim() + '</a><div class="table"></div>';
                        divAlbum.firstElementChild.firstElementChild.addEventListener('change', function(e) {
                            var element = e.target;
                            var i       = propertyInArray(element.id, 'id', albums);
                            element.parentElement.parentElement.lastElementChild.classList.toggle('hidden');
                            if (element.checked) {
                                if (i == -1) {
                                    if (element.name != '')
                                        albums.push({ 'id': element.id, 'smr': element.name });
                                    else albums.push({ 'id': element.id });
                                }
                                else {
                                    if (element.name != '')
                                        albums[i] = { 'id': element.id, 'smr': element.name };
                                    else albums[i] = { 'id': element.id };
                                }
                                writeArtists();
                            }
                            else if (i != -1) {
                                albums.splice(i, 1);
                                writeArtists();
                            }
                        }, false);
                        divArtistsHidden.appendChild(divAlbum);
                        var i = propertyInArray(tmp[2], 'id', albums);
                        checkAlbumPage(tmp[1], divAlbum, i, albums, artist, divArtist, albumCount);
                    }
                    else {
                        if (isClosestLang)
                            element.parentElement.nextSibling.href = 'http://www.qobuz.com' + tmp[1];
                        updateProgress(artist, albumCount);
                    }
                }
                if (end != 1)
                    checkArtistPage(albums, lang, isClosestLang, artist, divArtist, page + 1, end, albumCount);
            }
            else {
                if (file.status != 200)
                    showError(chromeI18n('unreachable'), lang + 'interpreter/' + artist + '/download-streaming-albums?page=' + page, divArtist, true);
                updateProgress(artist);
            }
        }
    };
    file.send();
}

function insertAlbum(artist, recentness, divAlbum) {
    var divArtistRecentNess = document.getElementById(artist + recentness);
    var divAlbumName        = divAlbum.children[1].innerHTML;
    var children            = divArtistRecentNess.children, length = children.length;
    if (length == 0) {
        divArtistRecentNess.classList.add('visible');
        divArtistRecentNess.appendChild(divAlbum);
    }
    else {
        for (var i = 0; i != length && compareStrings(children[i].children[1].innerHTML, divAlbumName) < 0; i++) {}
        divArtistRecentNess.insertBefore(divAlbum, i != length ? children[i] : null);
    }
}

function updateProgress(artist, albumCount) {
    var progress                    = document.getElementById(artist + 'progress');
    var newProgress                 = parseFloat(parseFloat(progress.firstElementChild.style.width.split('%')[0]) + (albumCount != null ? (1 / albumCount) * (100 / langs.length) : (100 / langs.length)));
    if (Math.round(newProgress * 100) / 100 >= 100) {
        newProgress                                                      = 100;
        progress.parentElement.firstElementChild.lastElementChild.hidden = false;
    }
    progress.firstElementChild.style.width  = newProgress + '%';
    progress.childNodes[1].nodeValue        = parseInt(newProgress) + '%';
}

function checkAlbumPage(link, divAlbum, i, albums, artist, divArtist, albumCount) {
    var file = new XMLHttpRequest();
    file.open('GET', 'http://www.qobuz.com' + link, true);
    file.setRequestHeader('Pragma', 'no-cache');
    file.setRequestHeader('Cache-Control', 'no-cache, must-revalidate');
    file.onreadystatechange = function() {
        if (file.readyState == XMLHttpRequest.DONE) {
            if (file.status == 200) {
                var response = file.responseText;
                var regExp   = /<span class="track-number">\s*([^<]*)<\/span>\s*<span class="track-title" itemprop="name">\s*([^<]*)(?:<i>([^<]*)<\/i>\s*)?<\/span>\s*<\/span>\s*<div [^>]*>\s*<meta [^>]*>\s*<span [^>]*>\s*([^<]*)/g;
                var tracklist = [], tmp;
                while ((tmp = regExp.exec(response)) != null)
                    tracklist.push('<div class="row"><div class="cell">' + tmp[1].trim() + '</div><div class="cell">' + tmp[2].trim() + (tmp[3] != null ? ' ' + tmp[3].trim() : '') + '</div><div class="cell">' + tmp[4].trim() + '</div></div>');
                var smr = response.match(/<div id="product-technical-informations-banner-right" [^>]*>\s*<span [^>]*>[^<]*<\/span>\s*<br \/>\s*<span>\s*(\S+)\s+\S+\s+\/\s+(\S+)\s+\S+\s+-\s+([^<]+)/);
                if (smr != null) {
                    tmp                                               = smr[1] + ' / ' + smr[2] + ' / ' + smr[3].trim();
                    divAlbum.firstElementChild.firstElementChild.name = tmp;
                    divAlbum.children[1].innerHTML                   += ' {' + tmp + '}';
                }
                if (i != -1 && (smr == null || albums[i]['smr'] == tmp)) {
                    divAlbum.firstElementChild.firstElementChild.checked = true;
                    divAlbum.lastElementChild.classList.toggle('hidden');
                    insertAlbum(artist, 'old', divAlbum);
                }
                else insertAlbum(artist, 'new', divAlbum);

                divAlbum.lastElementChild.innerHTML = tracklist.join('');
            }
            else showError(chromeI18n('unreachable'), link, divArtist, true);

            updateProgress(artist, albumCount);
        }
    };
    file.send();
}

function confirmFadeClick() {
    confirmlight.classList.remove('visible');
    confirmfade.classList.remove('visible');
}
confirmfade.addEventListener('click', confirmFadeClick, false);
confirmno.addEventListener('click', confirmFadeClick, false);
