var langs      = [];
var artists    = {};
var files      = {};
var chromeI18n = chrome.i18n.getMessage;
var langsLength, closestLang;

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

    createXMLHttpRequest('http://www.qobuz.com', function(file, link) {
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
            langsLength = langs.length;

            for (var i = 0; i != langsLength; i++) {
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
        else showError(chromeI18n('unreachable'), link, divArtists);
    });
}, false);

function createXMLHttpRequest(link, toDo, lang) {
    if (lang != null) {
        files[lang] = new XMLHttpRequest();
        files[lang].open('GET', link, true);
        files[lang].setRequestHeader('Pragma', 'no-cache');
        files[lang].setRequestHeader('Cache-Control', 'no-cache, must-revalidate');
        files[lang].onreadystatechange = function() {
            if (files[lang].readyState == XMLHttpRequest.DONE)
                toDo(files[lang], link);
        };
        files[lang].send();
    }
    else {
        var file = new XMLHttpRequest();
        file.open('GET', link, true);
        file.setRequestHeader('Pragma', 'no-cache');
        file.setRequestHeader('Cache-Control', 'no-cache, must-revalidate');
        file.onreadystatechange = function() {
            if (file.readyState == XMLHttpRequest.DONE)
                toDo(file, link);
        };
        file.send();
    }
}

function compareStrings(string1, string2) {
    return string1.localeCompare(string2, window.navigator.language, { 'sensitivity': 'accent' });
}

function convertIntTo2Int(value) {
    return value < 10 ? '0' + value : value;
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
    for (var i = 0, errors = container.getElementsByClassName('alert-close'), length = errors.length; i != length; i++)
        errors[i].click();

    var string = artistsname.value.trim();
    if (string == '') {
        showError(chromeI18n('empty'), null, container);
        return;
    }
    artistsresults.classList.remove('visible');
    artistsresults.innerHTML = '';
    artistsname.classList.add('loading');

    var i;
    for (i = 0; i != langsLength; i++) {
        try {
            files[langs[i]].abort();
        }
        catch (err) {}
    }

    for (i = 0; i != langsLength; i++)
        searchLang(langs[i], string);
}, false);

function searchLang(lang, string) {
    var tmp = lang.split(/[\/-]+/g);
    createXMLHttpRequest('http://www.qobuz.com/qbPackageSearchEnginePlugin/php/autocomplete-proxy.php?utf8=%E2%9C%93&q=' + encodeURIComponent(string) + '&zone=' + tmp[1] + '&language_code=' + tmp[2], function(file, link) {
        if (file.status == 200) {
            var response = file.responseText;
            var regExp   = /%%store_for_autocomplete%%\/interpreter\/([^\/]*)[^"]*"\s*class="overflow" rel="([^"]*)/g;
            var children = artistsresults.children;
            while ((tmp = regExp.exec(response)) != null) {
                if (!(tmp[1] in artists) && document.getElementById(tmp[1]) == null) {
                    var li       = document.createElement('li');
                    li.innerHTML = '<a id="' + tmp[1] + '">' + tmp[2] + '</a>';
                    li.firstElementChild.addEventListener('click', function(e) {
                        artistsname.value = '';
                        var value         = e.target.id;
                        artists[value]    = [];
                        writeArtists();
                        checkArtist(value);
                    }, false);

                    var i, length = children.length;
                    for (var i = 0; i != length && compareStrings(children[i].firstElementChild.innerHTML, tmp[2]) < 0; i++) {}
                    artistsresults.insertBefore(li, i != length ? children[i] : null);
                }
            }
        }
        else if (file.status != 0)
            showError(chromeI18n('unreachable'), link, container);

        var i;
        for (i = 0; i != langsLength && files[langs[i]].readyState == XMLHttpRequest.DONE; i++) {}
        if (i == langsLength) {
            artistsname.classList.remove('loading');

            if (artistsresults.innerHTML != '')
                artistsresults.classList.add('visible');
            else showError(chromeI18n('noresults'), null, container);
        }
    }, lang);
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
            showError(chromeI18n('jsoncompliant'), null, container);
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
        p.innerHTML = '<a href="' + link + '" target="_blank">' + string + '</a><a class="alert-close" title="' + chromeI18n('delete') + '">&times;</a>';
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
    divArtist.innerHTML = '<p class="alert notice"><a target="_blank">' + artist + '</a><a class="alert-close" title="' + chromeI18n('delete') + '" hidden>&times;</a></p><div id="' + artist + 'progress" class="progress"><span style="width: 0%"></span>0%</div><div class="leftright"><div id="' + artist + 'new" class="new"></div><div id="' + artist + 'old" class="old"></div></div><div class="leftright"><div id="' + artist + 'newvarious" class="new"></div><div id="' + artist + 'oldvarious" class="old"></div></div>';
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
    var children = divArtists.children;
    var length   = children.length;
    var i;
    for (i = 0; i != length && compareStrings(children[i].firstElementChild.firstElementChild.innerHTML, artist) < 0; i++) {}
    divArtists.insertBefore(divArtist, i != length ? children[i] : null);

    for (i = 0; i != langsLength; i++)
        checkArtistPage(artists[artist], langs[i], i == closestLang, artist, divArtist, 1);
}

function checkArtistPage(albums, lang, isClosestLang, artist, divArtist, page, albumCount) {
    createXMLHttpRequest('http://www.qobuz.com' + lang + 'interpreter/' + artist + '/download-streaming-albums?iac=1&page=' + page, function(file, link) {
        if (file.status == 200 && file.responseURL.match(new RegExp('^http://www.qobuz.com' + lang + 'interpreter/'))) {
            var response = file.responseText;
            var realName = response.match(/<h1>([^<]*)/)[1];
            if (divArtist.firstElementChild.firstElementChild.href == '') {
                divArtist.firstElementChild.firstElementChild.href      = 'http://www.qobuz.com' + lang + 'interpreter/' + artist + '/download-streaming-albums?iac=1';
                divArtist.firstElementChild.firstElementChild.innerHTML = realName;
            }
            else if (isClosestLang && albumCount == null)
                divArtist.firstElementChild.firstElementChild.href = 'http://www.qobuz.com' + lang + 'interpreter/' + artist + '/download-streaming-albums?iac=1';

            var lastPage = 0;
            if (albumCount == null) {
                regExp = /\?iac=1&amp;page=([1-9][0-9]*)/g;
                while ((tmp = regExp.exec(response)) != null)
                    if (parseInt(tmp[1]) > lastPage)
                        lastPage = parseInt(tmp[1]);
                albumCount = response.match(/<i class="icon-info-sign"><\/i>\s*<b>([^<]*)/)[1];
            }

            var regExp = /<div class="album-title">\s*<a href="([^"]*\/([0-9]+))" [^>]*>\s*([^<]*)/g;
            var tmp, albumName;
            while ((tmp = regExp.exec(response)) != null) {
                var element = document.getElementById(tmp[2]);
                if (element == null) {
                    albumName          = tmp[3].trim();
                    var divAlbum       = document.createElement('div');
                    divAlbum.className = 'album';
                    divAlbum.innerHTML = '<span class="switch unicode"><input id="' + tmp[2] + '" type="checkbox"><label for="' + tmp[2] + '" data-on="✓" data-off="✕"></label></span><a href="http://www.qobuz.com' + tmp[1] + '" target="_blank" title="' + albumName + '">' + albumName + '</a><div class="table"></div>';
                    divAlbum.firstElementChild.firstElementChild.addEventListener('change', function(e) {
                        var element = e.target;
                        var i       = propertyInArray(element.id, 'id', albums);
                        element.parentElement.parentElement.children[1].classList.toggle('sized');
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
                    checkAlbumPage(tmp[1], divAlbum, propertyInArray(tmp[2], 'id', albums), albums, artist, divArtist, albumCount, realName);
                }
                else {
                    if (isClosestLang)
                        element.parentElement.nextSibling.href = 'http://www.qobuz.com' + tmp[1];
                    updateProgress(artist, albumCount);
                }
            }
            if (lastPage != 0) {
                lastPage++;
                for (var i = 2; i != lastPage; i++)
                    checkArtistPage(albums, lang, isClosestLang, artist, divArtist, i, albumCount);
            }
        }
        else {
            if (file.status != 200)
                showError(chromeI18n('unreachable'), link, divArtist, true);
            updateProgress(artist);
        }
    });
}

function insertAlbum(artistRecentNess, divAlbum) {
    var divArtistRecentNess = document.getElementById(artistRecentNess);
    var divAlbumName        = divAlbum.children[1].innerHTML;
    var children            = divArtistRecentNess.children;
    var length              = children.length;
    if (length == 0) {
        divArtistRecentNess.classList.add('visible');
        divArtistRecentNess.appendChild(divAlbum);
    }
    else {
        var i;
        for (i = 0; i != length && compareStrings(children[i].children[1].innerHTML, divAlbumName) < 0; i++) {}
        divArtistRecentNess.insertBefore(divAlbum, i != length ? children[i] : null);
    }
}

function updateProgress(artist, albumCount) {
    var progress    = document.getElementById(artist + 'progress');
    var newProgress = parseFloat(parseFloat(progress.firstElementChild.style.width.split('%')[0]) + (albumCount != null ? (1 / albumCount) * (100 / langsLength) : (100 / langsLength)));
    if (Math.round(newProgress * 100) / 100 >= 100) {
        newProgress                                                      = 100;
        progress.hidden                                                  = true;
        progress.parentElement.firstElementChild.lastElementChild.hidden = false;
    }
    progress.firstElementChild.style.width = newProgress + '%';
    progress.childNodes[1].nodeValue       = parseInt(newProgress) + '%';
}

function checkAlbumPage(link, divAlbum, i, albums, artist, divArtist, albumCount, realName) {
    createXMLHttpRequest('http://www.qobuz.com' + link, function(file, link) {
        if (file.status == 200) {
            var response            = file.responseText;
            var albumArtistIsArtist = (new RegExp('<p class="txt04[^>]*>[^<]*<a[^>]*>' + realName)).test(response);
            var tracklist           = '';
            var various             = albumArtistIsArtist ? '' : 'various';
            var regExp              = /<span class="track-number">\s*([^<]*)<\/span>\s*<span class="track-title"[^>]*>\s*([^<]*(?:<3[^<]*)*)(?:<i>([^<]*)<\/i>\s*)?<\/span>\s*<\/span>\s*<div [^>]*>\s*(?:<meta [^>]*>\s*)?<span [^>]*>\s*([^<]*)/g;
            var tmp;
            while ((tmp = regExp.exec(response)) != null)
                tracklist += '<div class="row"><div class="cell">' + convertIntTo2Int(tmp[1].trim()) + '</div><div class="cell">' + tmp[2].trim() + (tmp[3] != null ? ' ' + tmp[3].trim() : '') + '</div><div class="cell">' + tmp[4].trim() + '</div></div>';
            divAlbum.lastElementChild.innerHTML = tracklist;

            if (tracklist != '') {
                var children = divAlbum.lastElementChild.children;
                var lengthM1 = children.length - 1;
                var j;
                for (j = 0; j != lengthM1; j++)
                    if (parseInt(children[j].firstElementChild.innerHTML) > parseInt(children[j + 1].firstElementChild.innerHTML))
                        break;
                if (j != lengthM1) {
                    var discNumber = 1;
                    var tmp2;
                    for (j = 0; j != lengthM1; j++) {
                        tmp           = children[j].firstElementChild;
                        tmp2          = parseInt(tmp.innerHTML);
                        tmp.innerHTML = discNumber + '.' + tmp.innerHTML;
                        if (tmp2 > parseInt(children[j + 1].firstElementChild.innerHTML))
                            discNumber++;
                    }
                    tmp           = children[j].firstElementChild;
                    tmp.innerHTML = discNumber + '.' + tmp.innerHTML;
                }

                if (!albumArtistIsArtist) {
                    regExp   = /<p class="track-details [^>]*>\s*<span>([^<]*)/g;
                    realName = realName.toLowerCase();
                    j        = 0;
                    while ((tmp = regExp.exec(response)) != null) {
                        if (tmp[1].toLowerCase().indexOf(realName) == -1)
                            divAlbum.lastElementChild.removeChild(children[j]);
                        else j++;
                    }
                }
            }

            var smr = response.match(/<li class="smrAwards" title="[^1-9]*(\S+)\s+\S+\s+\/\s+(\S+)\s+\S+\s+-\s+([^"]+)/);
            if (smr != null) {
                tmp                                               = smr[1] + ' / ' + smr[2] + ' / ' + smr[3].trim();
                divAlbum.firstElementChild.firstElementChild.name = tmp;
                divAlbum.children[1].innerHTML                   += ' {' + tmp + '}';
                divAlbum.children[1].title                       += ' {' + tmp + '}';
            }
            if (i != -1 && (smr == null || albums[i]['smr'] == tmp)) {
                divAlbum.firstElementChild.firstElementChild.checked = true;
                divAlbum.children[1].classList.add('sized');
                divAlbum.lastElementChild.classList.add('hidden');
                insertAlbum(artist + 'old' + various, divAlbum);
            }
            else insertAlbum(artist + 'new' + various, divAlbum);
        }
        else showError(chromeI18n('unreachable'), link, divArtist, true);

        updateProgress(artist, albumCount);
    });
}

function confirmFadeClick() {
    confirmlight.classList.remove('visible');
    confirmfade.classList.remove('visible');
}
confirmfade.addEventListener('click', confirmFadeClick, false);
confirmno.addEventListener('click', confirmFadeClick, false);
