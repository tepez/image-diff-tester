# image-diff-tester

## Motivation
Testing image differences in tests is very useful, e.g. taking and comparing screenshots of a web-app during e2e specs or comparing images of PDF files generated server side.

There are several projects out there that helps with this, but each of them requires you write your specs in a very specific way.

For example, [PhantomCSS](https://github.com/Huddle/PhantomCSS) requires you to write your specs in [CasperJS](https://github.com/casperjs/casperjs). What if you already have a lot of e2e specs written in Protractor and you just want to add screenshtos comparing to them?
This is the purpose of this tool.

